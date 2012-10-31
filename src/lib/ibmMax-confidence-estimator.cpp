//*****************************************
//
// \file   ivmMax-conficence-estimator.cpp
// \author Jesús González-Rubio
// \brief  Confidence Measure plugin for casmacat
//
// Copyright (C) 2012
//_________________________________________

#include <fstream>
#include <sstream>
#include <vector>
#include <cstdlib>
#include <ctime>
#include <cmath>
#include <string>
#include <vector>
#include "SmoothedIncrIbm1AligModel.h"

//#include <casmacat/config.h>
#include <casmacat/IConfidenceEngine.h>
#include <casmacat/IPluginFactory.h>
#include <casmacat/utils.h>

using namespace std;
using namespace casmacat;

class IBMConfidencer: public IConfidenceEngine, Loggable {
  Logger *_logger;
  SmoothedIncrIbm1AligModel ibm;
public:
  IBMConfidencer(): _logger(0) { }
  
  // do not forget to free all allocated resources
  // otherwise define the destructor with an empty body
  virtual ~IBMConfidencer() { LOG(INFO) << "IBMConfidencer am freed." << endl; };
	
  virtual float getWordConfidences(const vector<string> &source,
																	 const vector<string> &target,
																	 const vector<bool> &validated,
																	 vector<float> &confidences)
  {
		vector<WordIndex> srcSnt;
		vector<WordIndex> trgSnt;
		vector<bool> valSnt=validated;
    float nconf=0;
    
    // snt-ize source and target 
    srcSnt.clear();
    for(unsigned int i=0; i<source.size(); ++i)
      srcSnt.push_back(ibm.stringToSrcWordIndex(source[i]));
    
    trgSnt.clear();
    for(unsigned int i=0; i<target.size(); ++i)
			trgSnt.push_back(ibm.stringToTrgWordIndex(target[i]));
    
		// test vector sizes, if different we assume
		// TODO: all confidences must be computed
		if(target.size()!=valSnt.size()){
			valSnt.resize(trgSnt.size());
			for(unsigned int i=0; i<valSnt.size(); ++i)
				valSnt[i]=false;
		}
		
		
    // clean and prepare the confidences vector
    confidences.clear();
    confidences.resize(trgSnt.size());
    
    // we implement max ibm1 
    // validated words have confidence == 1
    for(unsigned int i=0; i<trgSnt.size(); ++i){
			if(!valSnt[i]){
				confidences[i]=float(ibm.pts(NULL_WORD,trgSnt[i]));
				for(unsigned int j=0; j<srcSnt.size(); ++j){
					nconf=float(ibm.pts(srcSnt[j],trgSnt[i]));
					if ( nconf > confidences[i] )
						confidences[i]=nconf;
				}
			}else
				confidences[i]=1.0;
    }
    return EXIT_SUCCESS;
  }

  virtual float getSentenceConfidence(const vector<string> &source,
                                      const vector<string> &target,
                                      const vector<bool> &validated)
  {
		vector<float> confidences;
		float nconf;
		
		getWordConfidences(source, target, validated, confidences);
		
		// score combination average
		nconf=0.0;
		for(unsigned int i=0; i<confidences.size(); ++i)
			nconf+=confidences[i];
		nconf/=confidences.size();
		
    return nconf;
  }
	
  virtual void setLogger(Logger *logger) {
    _logger = logger;
    LOG(INFO) << "IBMConfidencer is joining the logger";
  }
	
  // cargamos los modelos ibm a partir del prefijo de los ficheros
  int init(string filesPrefix)
  {
    string srcVocab(filesPrefix);
    string trgVocab(filesPrefix);
    
    srcVocab+=".trn.src.vcb";
    trgVocab+=".trn.trg.vcb";
    
    LOG(INFO) << "Initializing confidencer..." << endl;
    ibm.load(filesPrefix.c_str());
    
    return EXIT_SUCCESS;
  }

};



class IBMConfidenceFactory: public IConfidenceFactory {
  Logger *_logger;
  IBMConfidencer *rc;

public:
  IBMConfidenceFactory(): _logger(0) { }
  // do not forget to free all allocated resources
  // otherwise define the destructor with an empty body
  virtual ~IBMConfidenceFactory() {
    // TODO: delete rc here?;
    LOG(INFO) << "IBMConfidencer freed.";
  };


  // creation and initialization of the CM
  // only the prefix of the files is required
  virtual int init(int argc, char *argv[], Context *context = 0) {
		if (argc != 2)
      return EXIT_FAILURE;
    
    rc = new IBMConfidencer();
    rc->init(argv[1]);
    rc->setLogger(_logger);
    
    return EXIT_SUCCESS;
  }

  virtual string getVersion() { return "IBMConfidencer"; }

  virtual void setLogger(Logger *logger) {
    _logger = logger;
    LOG(INFO) << "IBMConfidenceFactory is joining the logger";
  }

  virtual IConfidenceEngine *createInstance(const string &specialization_id = "") {
    //TODO: consider to generate one new based on specialization_id
    return rc;
  }

};


EXPORT_CASMACAT_PLUGIN(IConfidenceEngine, IBMConfidenceFactory);


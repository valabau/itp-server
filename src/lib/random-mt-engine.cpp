// Moses plugin for casmacat

#include <fstream>
#include <sstream>
#include <iterator>
#include <vector>
#include <cstdlib>
#include <ctime>
#include <cmath>

#include <casmacat/IMtEngine.h>
#include <casmacat/utils.h>

using namespace std;
using namespace casmacat;

string random_string() {
  static string charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

  size_t length = size_t(rand() % 10);
  string result;
  result.resize(length);

  for (int i = 0; i < length; i++) {
    result[i] = charset[rand() % charset.length()];
  }

  return result;
}


class RandomMtEngine: public IMtEngine {
public:
  RandomMtEngine() {};
  virtual ~RandomMtEngine() {};
  /**
   * initialize the IMT engine with main-like parameters
   */
  virtual int init(int argc, char *argv[]) {
    if (argc > 2) { // invalid number of arguments
      return EXIT_FAILURE;
    }

    unsigned int seed = time(NULL);
    if (argc == 2) {
      seed = casmacat::convert_string<unsigned int>(string(argv[1]));
      if (not finite(seed)) { // check if initialization went wrong
        cerr << "Invalid seed = '" << argv[1] << "'\n";
        return EXIT_FAILURE;
      }
    }

    srand(seed);
    return EXIT_SUCCESS;
  }

  /* Set partial validation of a translation */
  virtual void translate(const std::vector<std::string> &source,
                               std::vector<std::string> &target)
  {
    target.resize(source.size());
    for (size_t t = 0; t < target.size(); t++) {
      if ((rand() / double(RAND_MAX)) > 0.5) {
        target[t] = random_string();
      }
    }
  }


  /* Update translation models with source/target pair (total or partial translation) */
  virtual void update(const std::vector<std::string> &source,
                      const std::vector<std::string> &target)
  {
    cout << "store validated sentence '";
    copy(source.begin(), source.end(), ostream_iterator<string>(cout, " "));
    cout << "' as";
    for (size_t t = 0; t < target.size(); t++) {
      cout << " " << target[t];
    }
    cout << "\n";
  }


private:
  // Following the rule of three copy and the assignment operator are disabled
  RandomMtEngine(const RandomMtEngine&);            // Disallow copy
  RandomMtEngine& operator=(const RandomMtEngine&); // Disallow assignment operator
};



EXPORT_CASMACAT_PLUGIN(IMtEngine, RandomMtEngine);

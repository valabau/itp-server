// -------------------------------------------------------------------------------
// These typemaps were provided by Matthias.
// Many thanks as they have saved me hours of work
// -------------------------------------------------------------------------------

typedef unsigned int uint32_t;

%template(StringVector) std::vector<std::string>;
%template(StringVectorVector) std::vector<std::vector<std::string> >;
%template(FloatVector)  std::vector<float>;
%template(BoolVector)   std::vector<bool>;
%template(IntVector)    std::vector<int>;
%template(FloatMatrix)  std::vector< std::vector<float> >;
%template(Segment)      std::pair<size_t, size_t>;
%template(Segmentation) std::vector<std::pair<size_t, size_t> >;



%define %RefOutputTypemapComplex(Type, Name)

%typemap(in,numinputs=0) Type& Name ($*1_ltype temp)  "$1 = &temp;"
%typemap(argout, fragment=SWIG_Traits_frag(Type)) Type& Name
{
    PyObject* o = swig::from(*$1);
    $result = t_output_helper( $result, o ); 
}

%enddef

%define %RefPtrOutputTypemapComplex( type, name )
	%typemap(in, numinputs=0) type*& name ($*1_ltype temp = 0)  "$1 = &temp; /*xxx*/"
	%typemap(argout, fragment=SWIG_Traits_frag(type)) type*& name 
	{
		PyObject* o = swig::from_ptr<type>(*$1, 0);
		$result = t_output_helper( $result, o ); 
	}
%enddef


%define %RefOutputComplex( type, name )
	%traits_swigtype( type );
	%fragment("t_output_helper");
	%RefOutputTypemapComplex( %arg(type), name );
%enddef

%define %RefPtrOutputComplex( type, name )
	%traits_swigtype( type );
	%fragment("t_output_helper");
	%RefPtrOutputTypemapComplex( %arg(type), name );
%enddef

%define %RefOutputString( name )
	%fragment("t_output_helper");
	%RefOutputTypemapComplex( std::string, name );
%enddef

%define %RefOutputStringVector( name )
	%fragment("t_output_helper");
	%RefOutputTypemapComplex( %arg(std::vector<std::string>), name );
%enddef

%define %RefOutputStringVectorVector( name )
	%fragment("t_output_helper");
	%RefOutputTypemapComplex( %arg(std::vector< std::vector<std::string> >), name );
%enddef

%define %RefOutputFloatVector( name )
	%fragment("t_output_helper");
	%RefOutputTypemapComplex( %arg(std::vector<float>), name );
%enddef

%define %RefOutputBoolVector( name )
	%fragment("t_output_helper");
	%RefOutputTypemapComplex( %arg(std::vector<bool>), name );
%enddef

%define %RefOutputIntVector( name )
	%fragment("t_output_helper");
	%RefOutputTypemapComplex( %arg(std::vector<int>), name );
%enddef

%define %RefOutputFloatMatrix( name )
	%fragment("t_output_helper");
	%RefOutputTypemapComplex( %arg(std::vector< std::vector<float> >), name );
%enddef

%define %RefOutputSegmentation( name )
	%fragment("t_output_helper");
	%RefOutputTypemapComplex( %arg(std::vector< std::pair<size_t, size_t> >), name );
%enddef


// -------------------------------------------------------------------------------

%define %RefOutputTypemapEnum(Type, Name)

%typemap(in,numinputs=0) Type& Name ($*1_ltype temp)  "$1 = &temp;"
%typemap(argout) Type& Name
{
    PyObject* obj = SWIG_From(int)(*$1);
    $result = t_output_helper( $result, obj ); 
}

%enddef


%define %RefOutputEnum( type, name )

%fragment("t_output_helper");
%RefOutputTypemapEnum( %arg(type), name );

%enddef

// -------------------------------------------------------------------------------

%define %RefOutputValue( type, name )

%apply type& OUTPUT {type& name};


%typemap(directorargout, fragment=SWIG_Traits_frag(type)) type& name
{
	// teeest2, problematic, see http://thread.gmane.org/gmane.comp.programming.swig/13745
	// maybe this is not problematic, check the AssetFS in Anima and the overridden IFS::TransformDevicePath function.
	PyObject* item = PySequence_GetItem( $input, $argnum );
	if (!item)
	{
		//LogTraceback();
		LogError( "Python director error, couldn't convert argument $result in return value" );
	}
	else
	{	
		$result = swig::as<type>( item );
		Py_DECREF( item );
	}
}

%enddef

%define %RefOuputDirectorOut(method)

%typemap(directorout) method
{
	// XXXXX
}

%enddef

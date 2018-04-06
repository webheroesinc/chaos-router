from setuptools import setup

setup(
    name                        = "chaosrouter",
    packages                    = [
        "chaosrouter",
    ],
    package_dir                 = {
        "chaosrouter":		".",
    },
    install_requires            = [
        'restruct',
    ],
    version                     = "0.2.6",
    include_package_data        = True,
    author                      = "Matthew Brisebois",
    author_email                = "matthew@webheroes.ca",
    url                         = "https://github.com/webheroesinc/chaos-router",
    license                     = "Dual License; GPLv3 and Proprietary",
    description                 = "Route path based requests to JSON endpoints.  Designed for web APIs",
    long_description            = """
Route path based requests to JSON endpoints.  Designed for web APIs

===============
 Usage examples
===============

::

      from chaosrouter			import ChaosRouter
    
      router				= ChaosRouter({
          "404": {
              "error": "Not Found",
              "message": "The page you are looking for does not exist",
              "code": 404
          }
      })
    
      Draft				= router.route("/404")
      data				= Draft.proceed()
      
      print(data)
    
      # Output:
      # {
      #     "error": "Not Found",
      #     "message": "The page you are looking for does not exist",
      #     "code": 404
      # }

    """,
    keywords                    = [""],
    classifiers                 = [
        "License :: OSI Approved :: GNU General Public License v3 or later (GPLv3+)",
        "License :: Other/Proprietary License",
        "Programming Language :: Python :: 3.5",
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers"
    ],
)

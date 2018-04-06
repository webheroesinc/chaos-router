from setuptools import setup

setup(
    name                        = "chaosrouter_core",
    packages                    = [
        "chaosrouter_core",
    ],
    package_dir                 = {
        "chaosrouter_core":	".",
    },
    install_requires            = [
        'restruct',
    ],
    version                     = "0.1.1",
    include_package_data        = True,
    author                      = "Matthew Brisebois",
    author_email                = "matthew@webheroes.ca",
    url                         = "https://github.com/webheroesinc/",
    license                     = "Dual License; GPLv3 and Proprietary",
    description                 = "Core suite of basic useful directives",
    long_description            = """
    Core suite of basic useful directives
    """,
    keywords                    = [""],
    classifiers                 = [
        "License :: OSI Approved :: GNU General Public License v3 or later (GPLv3+)",
        "License :: Other/Proprietary License",
        "Programming Language :: Python :: 3.5",
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers"
    ],
),


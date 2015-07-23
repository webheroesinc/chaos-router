from setuptools import setup

setup(
    name                        = "chaosrouter",
    packages                    = [
        "chaosrouter",
    ],
    package_dir                 = {
        "chaosrouter":         ".",
    },
    install_requires            = [
        'restruct',
    ],
    version                     = "0.1.0",
    include_package_data        = True,
    author                      = "Matthew Brisebois",
    author_email                = "matthew@webheroes.ca",
    url                         = "https://github.com/webheroesinc/",
    license                     = "Dual License; GPLv3 and Proprietary",
    description                 = "Convert JSON structures into api endpoints",
    long_description            = """
    Chaos Router takes json, and turns them into endpoints.
    """,
    keywords                    = [""],
    classifiers                 = [
        "License :: OSI Approved :: GNU General Public License v3 or later (GPLv3+)",
        "License :: Other/Proprietary License",
        "Programming Language :: Python :: 2.7",
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
    ],
)


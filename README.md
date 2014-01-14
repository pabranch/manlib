manlib
======

This script helps create a library of Linux/BSD man pages, and keep it up-to-date. This library can be used for any project, it's currently used on [mankier.com](http://www.mankier.com/).

Install npm dependencies:

    $ npm -g install jsonminify commander

**List** available sources:

    $ ./manlib.js list
    acl
    attr
    bash
    ...

(*Sources* are remote version control systems.)

**Set up** all sources:

    $ ./manlib.js setup

Or specify a source to set up, e.g.: `$ ./manlib.js setup acl`

**Extract** man pages from all sources:

    $ ./manlib.js extract

Or specify a source from which to extract man pages, e.g.: `$ ./manlib.js extract acl`

nroff files go in ./man docbook files go in ./xml

**Update** sources (generally followed by "extract" again):

    $ ./manlib.js update


Notes
-----

Commands on **all sources** (if a particular source is not specified) are run in **parallel**, this could use a lot of resources.

The **setup** command relies on git, hg, svn... being available depending on the sources used.

The **extract** command needs to "make" some of the sources (see sources.json). This can require any number of programs to be available: gcc, libtool, autoconf...

Contributions are welcome.
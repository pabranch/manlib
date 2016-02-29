#!/usr/bin/env node

require("jsonminify");
var fs = require('fs');
var program = require('commander');
var exec = require('child_process').exec;
var ftp = require('ftp-get');
var url = require('url');

var sourcesFile = './sources.json';
var sources;

program
  .version('0.0.1')
  .option('-s, --sources [file]', 'Use the specified sources file (default is ' + sourcesFile + ')');

program
  .command('list')
  .description('list sources')
  .action(function () {
    loadSources();
    for (var source in sources) {
      console.log(source);
    }
  });

program
  .command('info [source]')
  .description('show info on all sources, or just the specified source')
  .action(function (source) {
    loadSources();
    if (source) {
      if (!sources[source]) {
        console.log('Source not found: ' + source);
      } else {
        info(source, sources[source], true);
      }
    } else {
      for (var sourceName in sources) {
        info(sourceName, sources[sourceName]);
      }
    }
  });

program
  .command('setup [source]')
  .description('setup all sources, or just the specified source')
  .action(function (source) {
    loadSources();
    if (source) {
      if (!sources[source]) {
        console.log('Source not found: ' + source);
      } else {
        setup(source, sources[source], true);
      }
    } else {
      for (var sourceName in sources) {
        setup(sourceName, sources[sourceName]);
      }
    }
  });

program
  .command('extract [source]')
  .description('extract man pages from all sources, or from the specified source')
  .action(function (source) {
    loadSources();

    var i, newDir;
    if (!fs.existsSync('man')) {
      fs.mkdirSync('man');
    }
    if (!fs.existsSync('xml')) {
      fs.mkdirSync('xml');
    }
    for (i = 1; i <= 8; ++i) {
      newDir = 'man/man' + i;
      if (!fs.existsSync(newDir)) {
        fs.mkdirSync(newDir);
      }
      newDir = 'xml/man' + i;
      if (!fs.existsSync(newDir)) {
        fs.mkdirSync(newDir);
      }
    }

    if (source) {
      if (!sources[source]) {
        console.log('Source not found: ' + source);
      } else {
        extract(source, sources[source], true);
      }
    } else {
      for (var sourceName in sources) {
        extract(sourceName, sources[sourceName]);
      }
    }
  });

program
  .command('update [source]')
  .description('update all sources, or just the specified source')
  .action(function (source) {
    loadSources();

    if (source) {
      if (!sources[source]) {
        console.log('Source not found: ' + source);
      } else {
        update(source, sources[source], true);
      }
    } else {
      var timeouts = {};
      Object.keys(sources).forEach(function (sourceName) {
        var
          sourceDetails = sources[sourceName],
          host          = url.parse(sourceDetails.url).host;
        if (timeouts.hasOwnProperty(host)) {
          timeouts.host += 2000;
        } else {
          timeouts.host = 0;
        }
        setTimeout(function () {
          update(sourceName, sourceDetails);
        }, timeouts.host);
      });
    }
  });

program.parse(process.argv);

function loadSources () {

  if (program.sources) {
    sourcesFile = program.sources;
  }

  if (!fs.existsSync(sourcesFile)) {
    console.log('File ' + sourcesFile + ' does not exist. Please specify a sources file with --sources.');
    process.exit(1);
  }

  // JSON.minify: because there can be comments in sources.json.
  sources = JSON.parse(JSON.minify(fs.readFileSync(sourcesFile, 'utf8')));

}

function info (sourceName, sourceDets) {
  console.log(sourceName);
  console.log('Type: ' + sourceDets.type);
  console.log('URL: ' + sourceDets.url);
  console.log('Command: ' + sourceDets.cmd);
}

function extract (sourceName, sourceDets) {

  if (!sourceDets.cmd) {
    console.log('No command to extract man pages for: ' + sourceName);
    return;
  }

  exec(sourceDets.cmd, {maxBuffer: 5000 * 1024},
    function (error) {
      if (error !== null) {
        console.log(sourceDets.cmd + ' - error: ' + error);
      }
      /*if (stderr !== null) {
       console.log(sourceDets.cmd + ' - stderr: ' + stderr);
       }*/
    }
  );

}

function update (sourceName, sourceDets) {

  function doUp (repoCmd, repoCmdOpts) {
    exec(repoCmd, repoCmdOpts,
      function (error) {
        if (error !== null) {
          console.log(repoCmd + (repoCmdOpts.cwd ? ' in ' + repoCmdOpts.cwd : '') + ' - error: ' + error);
          console.log('Source: ' + sourceDets.url);
        }
      }
    );
  }

  var destDir = 'sources/' + sourceName;
  switch (sourceDets.type) {
    case 'git':
      if (sourceDets.tag) {
        exec('git fetch --tags; git describe --tags `git rev-list --tags --max-count=1`', {cwd: destDir},
          function (error, stdout) {
            var latestTag = stdout.trim();
            if (latestTag !== sourceDets.tag) {
              console.log(sourceName + ' is on tag ' + sourceDets.tag + ', consider checking for a newer tag to use. Latest remote tag: ' + latestTag);
            }
          }
        );
      } else {
        doUp('git pull --quiet --no-rebase', {cwd: destDir});
      }
      break;
    case 'svn':
      doUp('svn up ' + destDir, {});
      break;
    case 'cvs':
      doUp('cvs update', {cwd: destDir});
      break;
    case 'hg':
      doUp('hg pull -u', {cwd: destDir});
      break;
    case 'bzr':
      doUp('bzr pull', {cwd: destDir});
      break;
    case 'tarball':
      console.log(sourceName + ' is from tarball: ' + sourceDets.url + ', consider checking for a newer version.');
      break;
    default:
      console.log('Unrecognised source type: ' + sourceDets.type);
  }

}

function setup (sourceName, sourceDets, specified) {
  if (fs.existsSync('sources/' + sourceName)) {
    if (specified) {
      console.log('sources/' + sourceName + ' already exists');
    }
    return;
  }

  switch (sourceDets.type) {
    case 'git':
      setupGIT(sourceName, sourceDets);
      break;
    case 'svn':
      setupSVN(sourceName, sourceDets);
      break;
    case 'cvs':
      setupCVS(sourceName, sourceDets);
      break;
    case 'hg':
      setupHG(sourceName, sourceDets);
      break;
    case 'bzr':
      setupBZR(sourceName, sourceDets);
      break;
    case 'tarball':
      setupTarball(sourceName, sourceDets);
      break;
    default:
      console.log('Unrecognised source type: ' + sourceDets.type);
  }
}

function setupGIT (sourceName, sourceDets) {
  // git: don't use submodules. kind of neat, but then different all other sources + can't pre-set sparse checkout with submodules.
  var destDir = 'sources/' + sourceName;
  fs.mkdirSync(destDir);

  if (sourceDets.sparse) {
    exec('git init; git remote add -f origin ' + sourceDets.url + '; git config core.sparseCheckout true', {cwd: destDir},
      function (error) {
        if (error !== null) {
          console.log('git init; git remote add -f origin ' + sourceDets.url + '; git config core.sparseCheckout true - error: ' + error);
        } else {
          fs.writeFileSync(destDir + '/.git/info/sparse-checkout', sourceDets.sparse);
          exec('git checkout master', {cwd: destDir},
            function (error) {
              if (error !== null) {
                console.log('git checkout master - error: ' + error);
              }
            }
          );
        }
      }
    );

    // See native execSync in node.js 1.0

  } else {
    exec('git clone ' + sourceDets.url + ' ' + destDir,
      function (error) {
        if (error !== null) {
          console.log('git clone ' + sourceDets.url + ' ' + destDir + ' - error: ' + error);
        } else {
          if (sourceDets.tag) {
            var coTagCmd = 'git checkout ' + sourceDets.tag;
            exec(coTagCmd, {cwd: destDir},
              function (error) {
                if (error !== null) {
                  console.log(coTagCmd + ' - error: ' + error);
                }
              });
          }
        }

      });
  }

}

function setupSVN (sourceName, sourceDets) {
  var destDir = 'sources/' + sourceName;
  exec('svn -q co ' + sourceDets.url + ' ' + destDir,
    function (error) {
      if (error !== null) {
        console.log('svn co ' + sourceDets.url + ' ' + destDir + ' - error: ' + error);
      }
    });
}

function setupCVS (sourceName, sourceDets) {
  exec('cvs -z3 ' + sourceDets.url + ' checkout -P ' + sourceName, {cwd: 'sources'},
    function (error) {
      if (error !== null) {
        console.log('cvs -z3 ' + sourceDets.url + ' checkout -P ' + sourceName + ' - error: ' + error);
      }
    });
}

function setupHG (sourceName, sourceDets) {
  var destDir = 'sources/' + sourceName;
  exec('hg clone ' + sourceDets.url + ' ' + destDir,
    function (error) {
      if (error !== null) {
        console.log('hg clone ' + sourceDets.url + ' ' + destDir + ' - error: ' + error);
      }
    });
}

function setupBZR (sourceName, sourceDets) {
  var destDir = 'sources/' + sourceName;
  exec('bzr branch ' + sourceDets.url + ' ' + destDir,
    function (error) {
      if (error !== null) {
        console.log('bzr branch ' + sourceDets.url + ' ' + destDir + ' - error: ' + error);
      }
    });
}

function setupTarball (sourceName, sourceDets) {
  var destDir = 'sources/' + sourceName;

  if (sourceDets.url.indexOf('ftp') === 0) {
    var tmpFile = '/tmp/' + sourceName + '.tar.gz';
    ftp.get(sourceDets.url, tmpFile, function (error) {
      if (error) {
        console.error(error);
      } else {
        fs.mkdirSync(destDir);
        var extractTarballCmd = 'tar xf ' + tmpFile + ' -C ' + destDir;
        exec(extractTarballCmd, function (error) {
          if (error !== null) {
            console.log(extractTarballCmd + ' - error: ' + error);
          }
        });
      }
    });

  } else {
    var Download = require('download');
    new Download({extract: true, strip: true}).get(sourceDets.url).dest(destDir).run();
  }
}

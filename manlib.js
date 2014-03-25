#!/usr/bin/env node

require("jsonminify");
var fs = require('fs');
var program = require('commander');
var exec = require('child_process').exec;

var sourcesFile = './sources.json';
var sources;

program
  .version('0.0.1')
  .option('-s, --sources [file]', 'Use the specified sources file (default is ' + sourcesFile + ')');

var baseDir = process.cwd();

program
  .command('list')
  .description('list sources')
  .action(function (env) {
    loadSources();
    for (var source in sources) {
      console.log(source);
    }
  });

program
  .command('setup [source]')
  .description('setup all sources, or just the specified source')
  .action(function(source) {
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
  .action(function(source) {
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
  .action(function(source) {
    loadSources();

    if (source) {
      if (!sources[source]) {
        console.log('Source not found: ' + source);
      } else {
        update(source, sources[source], true);
      }
    } else {
      for (var sourceName in sources) {
        update(sourceName, sources[sourceName]);
      }
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

function extract (sourceName, sourceDets, specified) {

  if  (!sourceDets.cmd) {
    console.log('No command to extract man pages for : ' + sourceName);
    return;
  }

  exec(sourceDets.cmd,
    function (error, stdout, stderr) {
      if (error !== null) {
        console.log(sourceDets.cmd + ' - error: ' + error);
      }
      /*if (stderr !== null) {
        console.log(sourceDets.cmd + ' - stderr: ' + stderr);
      }*/
    }
  );

}

function update (sourceName, sourceDets, specified) {

  function doUp (repoCmd, repoCmdOpts) {
    exec(repoCmd, repoCmdOpts,
      function (error, stdout, stderr) {
        if (error !== null) {
          console.log(repoCmd + (repoCmdOpts.cwd ? ' in ' + repoCmdOpts.cwd : '') + ' - error: ' + error);
        }
      }
    );
  }

  var destDir = 'sources/' + sourceName;
  switch(sourceDets.type) {
    case 'git':
      if (sourceDets.tag) {
        console.log(sourceName + ' is on tag ' + sourceDets.tag + ', consider checking for a newer tag to use. Latest remote tag:');
        exec('git fetch --tags; git describe --tags `git rev-list --tags --max-count=1`', {cwd: destDir},
          function (error, stdout, stderr) {
            console.log(stdout);
          }
        );
      } else {
        doUp('git pull --no-rebase', {cwd: destDir});
      }
      break;
    case 'svn':
      doUp('svn up ' + destDir, {});
      break;
    case 'cvs':
      doUp('cvs update', {cwd: destDir});
      break;
    case 'hg':
      doUp('hg pull', {cwd: destDir});
      break;
    case 'bzr':
      doUp('bzr pull', {cwd: destDir});
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

  switch(sourceDets.type) {
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
      function (error, stdout, stderr) {
        if (error !== null) {
          console.log('git init; git remote add -f origin ' + sourceDets.url + '; git config core.sparseCheckout true - error: ' + error);
        } else {
          fs.writeFileSync(destDir + '/.git/info/sparse-checkout', sourceDets.sparse);
          exec('git checkout master', {cwd: destDir},
            function (error, stdout, stderr) {
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
      function (error, stdout, stderr) {
        if (error !== null) {
          console.log('git clone ' + sourceDets.url + ' ' + destDir + ' - error: ' + error);
        } else {
          if (sourceDets.tag) {
            var coTagCmd = 'git checkout ' + sourceDets.tag;
            exec(coTagCmd, {cwd: destDir},
            function (error, stdout, stderr) {
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
  exec('svn co ' + sourceDets.url + ' ' + destDir,
    function (error, stdout, stderr) {
      if (error !== null) {
        console.log('svn co ' + sourceDets.url + ' ' + destDir + ' - error: ' + error);
      }
  });
}

function setupCVS (sourceName, sourceDets) {
  exec('cvs -z3 ' + sourceDets.url + ' checkout -P ' + sourceName, {cwd: 'sources'},
    function (error, stdout, stderr) {
      if (error !== null) {
        console.log('cvs -z3 ' + sourceDets.url + ' checkout -P ' + sourceName + ' - error: ' + error);
      }
  });
}

function setupHG (sourceName, sourceDets) {
  var destDir = 'sources/' + sourceName;
  exec('hg clone ' + sourceDets.url + ' ' + destDir,
    function (error, stdout, stderr) {
      if (error !== null) {
        console.log('hg clone ' + sourceDets.url + ' ' + destDir + ' - error: ' + error);
      }
  });
}

function setupBZR (sourceName, sourceDets) {
  var destDir = 'sources/' + sourceName;
  exec('bzr branch ' + sourceDets.url + ' ' + destDir,
    function (error, stdout, stderr) {
      if (error !== null) {
        console.log('bzr branch ' + sourceDets.url + ' ' + destDir + ' - error: ' + error);
      }
  });
}
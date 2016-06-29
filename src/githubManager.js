#! /usr/bin/env node

'use strict'

/*
* Act on a Github repository or collection of repositories
*/

var GithubAPI = require('github');

var config = require('../config.json');
var Promise = global.Promise || require('es6-promise').Promise;

var clic = require('cli-color');

/*
* @param {Array<String>} repos A list of strings representing repositories to
*   act on. Strings can be in the form Organization/repo or regex in the form
*   Organization/repoRegex
*/
var GithubManager = function GithubManager(repos, githubAPI) {
  this._repoStrings = repos;
  this._reposPromise = GithubManager._retrieveRepos(this._repoStrings);
}

GithubManager.prototype = {

  list: function list(properties, verbose) {
    this._reposPromise.then(function(repos) {
      for(var i = 0; i < repos.length; i++) {
        if(verbose) {
          console.log(repos[i]);
        } else {
          console.log(repos[i].name);
        }
      }
    });
  },

  listLabels: function listLabels(group) {
    this._reposPromise.then(GithubManager._retrieveLabelsFromRepos).then(function(repos) {
      for(var i = 0; i < repos.length; i++) {
        if (group) console.log(repos[i].name);

        for(var j = 0; j < repos[i].labels.length; j++) {
          var labelsStr = ""
          if (group) labelsStr += "\t";

          labelsStr += repos[i].labels[j].name;

          console.log(labelsStr);
        }
      }
    });
  },

  addLabels: function addLabels(labelSetKey) {
    if (!labelSetKey) {
      console.log("You must enter a key for the labelSet defined in the config.json");
      return;
    }

    var labels = config.github.labelSets[labelSetKey];
    console.log(labels);
    if (!labels) {
      console.log("You must enter a valid label set key");
      return
    }

    this._reposPromise.then(function(repos) {
      var repoPromises = [];

      for(var i = 0; i < repos.length; i++) {
        var repo = repos[i];
        console.log("Adding labels to: ", repo.owner.login, "/", repo.name);
        var repoPromise = GithubManager._addLabelsToRepo(repo.owner.login,
          repo.name,
          labels);

        repoPromises.push(repoPromise);
      }

      Promise.all(repoPromises).then(function() {
        console.log("Finished");
      });
    })
  },

  addMilestone: function addMilestone(milestoneTitle, milestoneDescription) {
    if (!milestoneTitle) {
      console.log("You must enter a milestone name to add.");
      return;
    }

    this._reposPromise.then(function(repos) {
      var repoPromises = [];

      for(var i = 0; i < repos.length; i++) {
        var repo = repos[i];
        console.log("Adding milestone to: ", repo.owner.login, "/", repo.name);
        var repoPromise = GithubManager._addMilestoneToRepo(repo.owner.login, repo.name, milestoneTitle, milestoneDescription);

        repoPromises.push(repoPromise);
      }

      Promise.all(repoPromises).then(function() {
        console.log("Finished");
      });
    });

  },

  assignAll: function assignAll(assignee, verbose) {
    this._reposPromise.then(GithubManager._retrieveIssuesFromRepos).then(function(repos) {
      var repoPromises = [];
      var totalFailures = 0;
      var totalSuccesses = 0;
      for(var i = 0; i < repos.length; i++) {
        var repoPromise = new Promise(function (resolve, reject){
          var repo = repos[i];
          var repoOutput = "";
          repo.successes = 0;
          repo.failures = 0;
          var issues = repo.issues;
          // String like: "=  owner/repo (i/n)  ="
          var displayName = "=  " + repo.owner.login + "/" + repo.name + " (" + (i + 1) + "/" + repos.length + ")  =";
          if(verbose) {
            repoOutput += GithubManager._repeat("=", displayName.length) + "\n";
            repoOutput += displayName + "\n";
            repoOutput += GithubManager._repeat("=", displayName.length) + "\n";
            repoOutput += "Found " + issues.length + " unassigned issues.\n";
          }
          var issuePromises = [];
          for (var j = 0; j < issues.length; j++) {
            var issuePromise = new Promise(function(res, rej) {
              var issue = issues[j];
              GithubManager._githubAPI.issues.edit({
                user: repo.owner.login,
                repo: repo.name,
                number: issue.number,
                assignee: assignee
              }, function(err, data) {
                if (err && err.hasOwnProperty("message") && /Validation Failed/.test(err.message)) {
                  if (verbose) {
                    repoOutput += "#" + issue.number + ": fail\n";
                  }
                  repo.failures += 1;
                } else {
                  if (verbose) {
                    repoOutput += "#" + issue.number + ": assigned to " + assignee + "\n";
                  }
                  repo.successes += 1;
                }
                res(issue);
              });
            });
            issuePromises.push(issue);
          }
          Promise.all(issuePromises).then(function(issues) {
            if (verbose) {
              console.log(repoOutput);
              console.log("> " + repo.successes + " successes and " + repo.failures + " failures.");
            }
            totalSuccesses += repo.successes;
            totalFailures += repo.failures;
            resolve(repo);
          });
        });
        repoPromises.push(repoPromise);
      }
      return Promise.all(repoPromises).then(function(repos) {
        console.log("Done: " + totalSuccesses + " successes and " + totalFailures + " failures.");
        return repos;
      })
    });
  }
}

GithubManager._githubAPI = new GithubAPI({
    "version": "3.0.0"
})

/*
* @param {Object} opts The settings to pass into the gitub authenticate method
*/
GithubManager.auth = function(opts) {
  GithubManager._githubAPI.authenticate(opts);
}



/*
* @param {Array<Repos>} repos A list of repo objects to retrieve tags for
* @return {Promise<Array<Repos>>} A promise that resolves to a list of repo
*   objects, with the list of tags added as a top-level property
*/
GithubManager._retrieveLabelsFromRepos = function(repos) {
  var labelPromises = [];

  for (var i = 0; i < repos.length; i++) {
    var labelPromise = new Promise(function(resolve, reject) {
      var repo = repos[i];
      GithubManager._githubAPI.issues.getLabels({
        user: repo.owner.login,
        repo: repo.name,
        //TODO: Apply this recursively to get all pages no matter what.
        per_page: 100
      }, function(err, labels) {
        if (err) reject(err);

        repo["labels"] = labels;
        resolve(repo);
      });
    })

    labelPromises.push(labelPromise);
  }

  return Promise.all(labelPromises).then(function(repos) {
    console.log(repos[0].name, repos[1].name)
    return repos;
  });
}

/*
* @param {Array<Repos>} repos A list of repo objects to retrieve tags for
* @return {Promise<Array<Repos>>} A promise that resolves to a list of repo
*   objects, with the list of tags added as a top-level property
*/
GithubManager._retrieveIssuesFromRepos = function(repos) {
  var issuePromises = [];

  for (var i = 0; i < repos.length; i++) {
    var issuePromise = new Promise(function(resolve, reject) {
      var repo = repos[i];

      GithubManager._githubAPI.issues.repoIssues({
        user: repo.owner.login,
        repo: repo.name,
        assignee: 'none',
        state: 'open',
        per_page: 100
      }, GithubManager._promoteError(reject, function(res) {
        GithubManager._followPages(function() {}, reject, [], res);
        repo["issues"] = res;
        resolve(repo);
      }));
    });

    issuePromises.push(issuePromise);
  }

  return Promise.all(issuePromises).then(function(repos) {
    return repos;
  });
}

/*
 * @param {String} pattern A string to repeat
 * @param {Number} count The number of times to repeat it
 * @return {String} the pattern, repeated count times.
 */
GithubManager._repeat = function(pattern, count) {
    if (count < 1) return '';
    var result = '';
    while (count > 1) {
        if (count & 1) result += pattern;
        count >>= 1, pattern += pattern;
    }
    return result + pattern;
}

/*
 * @param {function} reject The Promise reject
 * @param {function} resolve The Promise resolve
 * @return a GithubManager callback function that prints errors.
 */
GithubManager._promoteError = function(reject, resolve) {
  return function(err, res) {
    if (err) {
      if (err.hasOwnProperty("message") && /rate limit exceeded/.test(err.message)) {
        rateLimitExceeded = true;
      }

      console.error("caught error: %s", err);
      reject(err);
    }
    else {
      resolve(res);
    }
  };
}

/*
 * @param {function} reject The Promise reject
 * @param {function} resolve The Promise resolve
 * @param {Array<Object>} result an array of JSON responses
 * @param {Object} res The response from the response
 * @return a GithubManager callback function that prints errors.
 */
GithubManager._followPages = function(resolve, reject, result, res) {
  var i;

  for (i = 0;  i < res.length;  ++i) {
    result.push(res[i]);
  }

  if (GithubManager._githubAPI.hasNextPage(res)) {
    GithubManager._githubAPI.getNextPage(res, GithubManager._promoteError(reject, function(res) {
      GithubManager._followPages(resolve, reject, result, res);
    }));
  }
  else {
    resolve(result);
  }
}



/*
* @param {Array<String>} repoStrings A list of strings to resolve to repos
* @return {Promise} Returns a promise that resolves to a list of repo objects
*/
GithubManager._retrieveRepos = function(repoStrings) {
  var repoPromises = [];
  for (var i = 0; i < repoStrings.length; i++) {
    var splitRepoString = GithubManager._tokenizeRepoString(repoStrings[i]);

    var repoPromise = GithubManager._retrieveMatchingRepos(splitRepoString[0],
      splitRepoString[1]);
    repoPromises.push(repoPromise);
  }

  return Promise.all(repoPromises).then(function(repoLists) {
    var allRepos = [];
    for (var i = 0; i < repoLists.length; i++) {
      allRepos = allRepos.concat(repoLists[i]);
    }

    return allRepos;
  });
}

/*
* @param {String} ownerStr The repo owner
* @param {String} repoStr The repo string, which can be either a string or a
*  regex
* @return {Promise} Returns a promise that resolves to the list of repository
*  objects from github
*/
GithubManager._retrieveMatchingRepos = function(ownerStr, repoStr) {
  return new Promise(function(resolve, reject) {
    if (GithubManager._isRegex(repoStr)) {
      // Get all of the owner's repos and then match by name with the regex

      GithubManager._getAllReposFromOrg({
        org: ownerStr
      }).then(function(allRepos) {
        var filteredRepos = GithubManager._filterReposByRegex(allRepos, repoStr);
        resolve(filteredRepos);
      });

    } else {
      GithubManager._githubAPI.repos.get({
        user: ownerStr,
        repo: repoStr
      }, function(err, repo) {
        if (err) reject(err);
        resolve([repo]);
      });
    }
  });

}

/*
* @param {Array<Repository>} repos An array of repository objects to filter
* @param {String} regexStr The regex string to filter repo names. Adds start and
*   end delimiters automatically if they're not there to match the entire string.
* @return {Array<Repository>} The array of filtered repos whose names match regexStr
*/
GithubManager._filterReposByRegex = function(repos, regexStr) {
  if (regexStr[0] != '^') regexStr = '^' + regexStr;
  if (regexStr[-1] != '$') regexStr = regexStr + '$';

  var matchedRepos = [];
  for (var i = 0; i < repos.length; i++) {
    var repo = repos[i];
    if (repo.name.match(regexStr)) {
      matchedRepos.push(repo);
    }
  }

  return matchedRepos;
}

/*
* @param {Object} opts The opts to send in getReposFromOrg, usually just org
* @return {Promise} Returns a promise that resolves to the complete list of repos
*/
GithubManager._getAllReposFromOrg = function(opts) {

  var allRepos = [];

  return new Promise(function(resolve, reject) {
    var getNextPage = function(currPage) {
      GithubManager._githubAPI.repos.getFromOrg({
        org: opts.org,
        page: currPage + 1
      }, function(err, repos) {
        if (err) {
          reject(err);
        }

        if (repos.length == 0) {
          resolve(allRepos);
          return;
        }
        allRepos = allRepos.concat(repos);
        getNextPage(currPage + 1);
      })
    }

    getNextPage(0);
  });
}

/*
* @param {String} repoString A string in the form Organization/repo to split
* @return {Array<String>} An array of the form [Organization, repo]
*/
GithubManager._tokenizeRepoString = function(repoString) {
  var split = repoString.split("/");
  if (split.length != 2) {
    throw new Error("Invalid repo string: " + repoString);
  }

  return split;
}

/*
* @param {String} ownerStr The repo owner
* @param {String} repoStr The repo string
* @param {Map<String, String>} labels The map from labelName > 6 char hex value
*   without the leading #
* @return {Promise} A promise that resolves when the call complete, or rejects
*   if there's an error
*/
GithubManager._addLabelsToRepo = function(ownerStr, repoStr, labels) {
  var labelPromises = [];
  for(var key in labels) {
    var labelPromise = GithubManager._addLabelToRepo(ownerStr, repoStr, key, labels[key]);
    labelPromises.push(labelPromise);
  }

  return Promise.all(labelPromises);
}

/*
* @param {String} ownerStr The repo owner
* @param {String} repoStr The repo string
* @param {String} labelName The name of the label to add
* @param {String} labelColor The 6-character hex value withou the #
*/
GithubManager._addLabelToRepo = function(ownerStr, repoStr, labelName, labelColor) {
  return new Promise(function(resolve, reject) {
    GithubManager._githubAPI.issues.createLabel({
      user: ownerStr,
      repo: repoStr,
      name: labelName,
      color: labelColor
    }, function(err) {
      if (err) {
        reject(err);
      }
      resolve();
    });
  });
}

GithubManager._addMilestoneToRepo = function(ownerStr, repoStr, milestoneTitle, milestoneDescription) {
  return new Promise(function(resolve, reject) {
    GithubManager._githubAPI.issues.createMilestone({
      user: ownerStr,
      repo: repoStr,
      title: milestoneTitle,
      description: milestoneDescription
    })
  })
}
/*
* @param {String} str The repo name to test if it includes regex-specific chars
* @return {Boolean} True if the string is meant as a regex otherwise false
*/
GithubManager._isRegex = function(repoString) {
  var matches = repoString.match( /^[a-zA-Z0-9-]+$/ )
  return (matches === null);
}

/*
* @param {String} repoRegex The typical first argument, a single regex for a repo
* @param {Array<String>} otherRepos An array of additional regex strings
* @return {Array<String>} A single list of repo regex strings
*/
GithubManager.combineRepoArgs = function(repoRegex, otherRepos) {
  var repos = [];
  repos.push(repoRegex);

  if (otherRepos.length) {
    repos = repos.concat(otherRepos)
  }
  return repos;
}

/*
* @param {String} repoRegex The typical first argument, a single regex for a repo
* @param {Array<String>} otherRepos An array of additional regex strings
* @return {GithubManager} A GithubManager object with the repos passed in
*/
GithubManager.getGithubManager = function(repoRegex, otherRepos) {
  var repos = GithubManager.combineRepoArgs(repoRegex, otherRepos);

  var manager = new GithubManager(repos);
  return manager;
}

module.exports = GithubManager;

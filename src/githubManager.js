#! /usr/bin/env node

'use strict'

/*
* Act on a Github repository or collection of repositories
*/

var GithubAPI = require('github');
var github = new GithubAPI({
  "version": "3.0.0"
});

var config = require('../config.json');
var Promise = global.Promise || require('es6-promise').Promise;

var clic = require('cli-color');

/*
* @param {Array<String>} repos A list of strings representing repositories to
*   act on. Strings can be in the form Organization/repo or regex in the form
*   Organization/repoRegex
*/
var GithubManager = function GithubManager(repos) {
  github.authenticate({
    type: "oauth",
    token: config.github.token
  });

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

  labels: function labels(list, group) {
    this._reposPromise.then(GithubManager._retrieveLabelsFromRepos).then(function(repos) {
      if (list) {
        for(var i = 0; i < repos.length; i++) {
          if (group) console.log(repos[i].name);

          for(var j = 0; j < repos[i].labels.length; j++) {
            var labelsStr = ""
            if (group) labelsStr += "\t";

            labelsStr += repos[i].labels[j].name;

            console.log(labelsStr);
          }
        }
      }
    });
  }
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
      github.issues.getLabels({
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
      var repo = github.repos.get({
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
* @param {String} regexStr The regex string to filter repo names
* @return {Array<Repository>} The array of filtered repos whose names match regexStr
*/
GithubManager._filterReposByRegex = function(repos, regexStr) {
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
      github.repos.getFromOrg({
        org: opts.org,
        page: currPage + 1
      }, function(err, repos) {
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
* @param {String} str The repo name to test if it includes regex-specific chars
* @return {Boolean} True if the string is meant as a regex otherwise false
*/
GithubManager._isRegex = function(repoString) {
  var matches = repoString.match( /^[a-zA-Z0-9-]+$/ )
  return (matches === null);
}

module.exports = GithubManager;

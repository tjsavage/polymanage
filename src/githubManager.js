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
  this._repos = repos;
}

GithubManager.prototype = {
  list: function list() {
    GithubManager._retrieveRepos(this._repos).then(function(repos) {
      for(var i = 0; i < repos.length; i++) {
        console.log(repos[i].name);
      }
    });
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

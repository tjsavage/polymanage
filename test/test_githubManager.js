var expect = require('chai').expect;

describe("githubManager", function() {
  var GithubManager;

  beforeEach(function() {
    GithubManager = require("../src/githubManager");
  });

  describe("_tokenizeRepoString", function() {
    it("should correctly tokenize a well-formed string", function() {
      var result = GithubManager._tokenizeRepoString("Org/repo");

      expect(result).to.deep.equal(["Org", "repo"])
    });

    it("should throw an error with a string with no org", function() {
      var func = GithubManager._tokenizeRepoString.bind(GithubManager, "repo");

      expect(func).to.throw(Error);
    })
  });

  describe("_isRegex", function() {
    it("should not identify a basic repo as a regex", function() {
      expect(GithubManager._isRegex("myrepo")).to.be.false;
      expect(GithubManager._isRegex("my-repo")).to.be.false;
      expect(GithubManager._isRegex("MyREPO")).to.be.false;
      expect(GithubManager._isRegex("My-Repo")).to.be.false;
    });

    it("should identify wildcard repos as regex", function() {
      expect(GithubManager._isRegex("my-.*")).to.be.true;
    })
  });

  describe("_getAllReposFromOrg", function() {
    it("should reject if there's an error", function(done) {
      GithubManager._githubAPI = {
        repos: {
          getFromOrg: function(opts, cb) {
            expect(opts.org).to.equal("myOrg");

            cb(new Error("error!"), null);
          }
        }
      };

      GithubManager._getAllReposFromOrg({org: "myOrg"}).then(function(result) {
      }, function(err) {
        expect(err).to.be.ok;
        done();
      }).catch(done);
    });

    it("should correctly return a single page of repos", function(done) {
      GithubManager._githubAPI = {
        repos: {
          getFromOrg: function(opts, cb) {
            expect(opts.org).to.equal("myOrg");
            if(opts.page == 1) {
              cb(null, ["Repo1", "Repo2"]);
            } else {
              cb(null, []);
            }
          }
        }
      };

      GithubManager._getAllReposFromOrg({org: "myOrg"}).then(function(result) {
        expect(result).to.deep.equal(["Repo1", "Repo2"]);
        done();
      }, function(err) {
        done(err);
      }).catch(done);
    });

    it("should correct return multiple pages of repos", function(done) {
      var GithubManager = require("../src/githubManager");

      GithubManager._githubAPI = {
        repos: {
          getFromOrg: function(opts, cb) {
            expect(opts.org).to.equal("myOrg");

            if(!opts.page || opts.page == 1) {
              cb(null, ["Repo1", "Repo2"]);
            } else if (opts.page == 2) {
              cb(null, ["Repo3", "Repo4"]);
            } else if (opts.page == 3) {
              cb(null, ["Repo5", "Repo6"]);
            } else if (opts.page > 3) {
              cb(null, []);
            }
          }
        }
      };

      GithubManager._getAllReposFromOrg({org: "myOrg"}).then(function(result) {
        expect(result).to.deep.equal(["Repo1", "Repo2", "Repo3", "Repo4", "Repo5", "Repo6"]);
        done();
      }, done).catch(done);
    })
  });

  describe("_filterReposByRegex", function() {
    var repos;

    beforeEach(function() {
      repos = [
        {name: "repo1"},
        {name: "repo2"},
        {name: "repo3"},
        {name: "ropo1"},
        {name: "my-repo"}
      ];
    });

    it("should correctly filter repos when the regex is just a plain string", function() {
      expect(GithubManager._filterReposByRegex(repos, "repo1")).to.deep.equal([{name: "repo1"}])
    });

    it("should correctly filter for the entire string based on a wildcard", function() {
      expect(GithubManager._filterReposByRegex(repos, "repo.*")).to.deep.equal([
        {name: "repo1"},
        {name: "repo2"},
        {name: "repo3"}
      ]);
    });

    it("should correctly filter for the entire string based on a starting wildcard", function() {
      expect(GithubManager._filterReposByRegex(repos, ".*repo")).to.deep.equal([
        {name: "my-repo"}
      ]);
    });

    it("should correctly match a complex regex", function() {
      expect(GithubManager._filterReposByRegex(repos, "r[eo]po1")).to.deep.equal([
        {name: "repo1"},
        {name: "ropo1"}
      ]);
    })
  });

  describe("_retrieveMatchingRepos", function() {
    it("should correctly return a single direct repo", function(done) {
      GithubManager._githubAPI = {
        repos: {
          get: function(opts, cb) {
            expect(opts.user).to.equal("myOrg");
            expect(opts.repo).to.equal("Repo2");

            cb(null, "Repo2");
          }
        }
      };

      GithubManager._retrieveMatchingRepos("myOrg", "Repo2").then(function(result) {
        expect(result).to.deep.equal(["Repo2"]);
        done();
      }, done).catch(done);
    });

    it("should correct return a list of repos matching a regex", function(done) {
      var GithubManager = require("../src/githubManager");

      GithubManager._githubAPI = {
        repos: {
          getFromOrg: function(opts, cb) {
            expect(opts.org).to.equal("myOrg");

            if (opts.page == 1) {
              cb(null, [{name: "Repo1"}, {name: "Repo2"}, {name: "Repo3"}, {name: "my-repo"}]);
            } else {
              cb(null, []);
            }

          }
        }
      };

      GithubManager._retrieveMatchingRepos("myOrg", ".*epo1?").then(function(result) {
        expect(result).to.deep.equal([{name: "Repo1"}, {name: "my-repo"}]);
        done();
      }, done).catch(done);
    });

    it("should correct return multiple pages worth of repos matching a regex", function(done) {
      GithubManager._githubAPI = {
        repos: {
          getFromOrg: function(opts, cb) {
            expect(opts.org).to.equal("myOrg");

            if(opts.page == 1) {
              cb(null, [{name: "Repo1"}, {name: "Repo2"}]);
            } else if (opts.page == 2) {
              cb(null, [{name: "my-repo"}, {name: "my-ropo"}]);
            } else if (opts.page == 3) {
              cb(null, [{name: "goodrepo"}, {name: "badrepo"}]);
            } else {
              cb(null, []);
            }
          }
        }
      };

      GithubManager._retrieveMatchingRepos("myOrg", ".*epo1?").then(function(result) {
        expect(result).to.deep.equal([{name: "Repo1"}, {name: "my-repo"}, {name: "goodrepo"}, {name: "badrepo"}]);
        done();
      }, done).catch(done);
    })
  });

  describe("_addLabelToRepo", function() {
    it("should correctly add a label to a single repo", function(done) {
      GithubManager._githubAPI = {
        issues: {
          createLabel: function(opts, cb) {
            expect(opts.user).to.equal("myOrg");
            expect(opts.repo).to.equal("Repo1");
            expect(opts.name).to.equal("LabelName");
            expect(opts.color).to.equal("ffffff");

            cb(null, null);
          }
        }
      };

      GithubManager._addLabelToRepo("myOrg", "Repo1", "LabelName", "ffffff").then(function(result) {
        expect(result).to.be.undefined;
        done();
      }, done).catch(done);
    });
  });

  describe("_addLabelsToRepo", function() {
    it("should correctly add multiple labels to a single repo", function(done) {
      GithubManager._githubAPI = {
        issues: {
          createLabel: function(opts, cb) {
            expect(opts.user).to.equal("myOrg");
            expect(opts.repo).to.equal("Repo1");

            if (opts.name == "label1") {
              expect(opts.color).to.equal("ffffff");
              cb(null, null);
            } else if (opts.name == "label2") {
              expect(opts.color).to.equal("000000");
              cb(null, null);
            } else {
              throw new Error("wrong label name");
            }
          }
        }
      }

      GithubManager._addLabelsToRepo("myOrg", "Repo1", {
        "label1": "ffffff",
        "label2": "000000"
      }).then(function(result) {
        expect(result.length).to.equal(2);
        done();
      }, done).catch(done);
    });

  })

})

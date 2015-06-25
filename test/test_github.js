var expect = require('chai').expect;

var githubManager = require("../src/githubManager");

describe("githubManager", function() {
  before(function() {

  });

  describe("_tokenizeRepoString", function() {
    it("should correctly tokenize a well-formed string", function() {
      var result = githubManager._tokenizeRepoString("Org/repo");

      expect(result).to.deep.equal(["Org", "repo"])
    });

    it("should throw an error with a string with no org", function() {
      var func = githubManager._tokenizeRepoString.bind(githubManager, "repo");

      expect(func).to.throw(Error);
    })
  });

  describe("_isRegex", function() {
    it("should not identify a basic repo as a regex", function() {
      expect(githubManager._isRegex("myrepo")).to.be.false;
      expect(githubManager._isRegex("my-repo")).to.be.false;
      expect(githubManager._isRegex("MyREPO")).to.be.false;
      expect(githubManager._isRegex("My-Repo")).to.be.false;
    });

    it("should identify wildcard repos as regex", function() {
      expect(githubManager._isRegex("my-.*")).to.be.true;
    })
  })
})

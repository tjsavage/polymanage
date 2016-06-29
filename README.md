# polymanage
A management tool for teams using Polymer and building lots of elements

## Features

Implemented
* List repos based on regexes
* Add tags to matching repos
* Add milestones to matching repos
* Add a consistent set of tags to a large group of repos

## Using

Woefully under-documented. Still a work-in-progress. Follow the rabbit hole of `polymanage --help`

## Developing

1.  Make a secrets file:

    ```npm
    cp example.config.json config.json
    ```
    
2.  Make an [new personal access token](https://github.com/settings/tokens/new) on GitHub.
3.  Paste your access token into `config.json`.
4.  Run:

    ```bash
    npm install
    ```



// Detection of the compose-bin fixture (test/fixtures/projects/compose-bin) as the component 01
// detector prints it with docker on PATH; the session kind is set by the caller.
export function sageComposeDetection(root, session = { kind: 'local', dockerCli: true }) {
  const detection = {
    "tool": {
      "name": "detect-roots-project",
      "version": "3.0.0"
    },
    "layout": "unknown",
    "coreDir": null,
    "apps": [
      {
        "kind": "sage-theme",
        "path": ".",
        "namespace": "App\\",
        "basePathHint": "theme-inferred",
        "boot": {
          "file": "functions.php",
          "hook": null,
          "priority": null
        },
        "providers": {
          "source": "functions.php",
          "file": "functions.php"
        },
        "blocks": "none",
        "postTypes": "none",
        "versions": {
          "roots/acorn": "^6.0"
        }
      }
    ],
    "active": 0,
    "site": {
      "versions": {},
      "wpCli": {
        "path": null,
        "docroot": null
      }
    },
    "runtime": {
      "runner": "compose",
      "lando": null,
      "compose": {
        "files": [
          "compose.yaml",
          "compose.override.yaml"
        ],
        "contract": {
          "name": "kivo-wp",
          "version": 1
        },
        "devcontainer": ".devcontainer/devcontainer.json",
        "services": {
          "php": "app",
          "web": "app",
          "database": "db",
          "cache": "cache",
          "node": "node",
          "proxy": "proxy",
          "mail": "mail"
        },
        "bin": [
          "build",
          "composer",
          "dev",
          "flush",
          "logs",
          "mago",
          "npm",
          "test",
          "wp"
        ],
        "parseErrors": []
      },
      "session": {
        "kind": "local",
        "dockerCli": true
      },
      "runners": {
        "wp": "bin/wp",
        "acorn": "bin/wp acorn",
        "composer": "bin/composer",
        "node": "bin/npm",
        "test": "bin/test",
        "lint": "bin/mago",
        "cache": "bin/flush",
        "build": "bin/build",
        "dev": "bin/dev",
        "login": null,
        "logs": "bin/logs"
      }
    },
    "flag": null,
    "warnings": [],
    "notes": [],
    "truncated": false
  };
  detection.root = root;
  detection.runtime.session = session;
  return detection;
}

export function rootArg() {
  return (process.argv.find((a) => a.startsWith('--path=')) || '--path=.').slice(7);
}

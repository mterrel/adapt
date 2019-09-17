[![Adapt logo](https://adaptjs.org/img/logo_lockup.svg)](https://adaptjs.org)

[![npm](https://img.shields.io/npm/v/@adpt/cli?color=blue)](https://www.npmjs.com/package/@adpt/cli)
[![Gitter](https://badges.gitter.im/UnboundedSystems/Adapt.svg)](https://gitter.im/UnboundedSystems/Adapt)
[![License](https://img.shields.io/github/license/unboundedsystems/adapt)](https://opensource.org/licenses/Apache-2.0)

# Adapt - ReactJS for your infrastructure.

Adapt is a system to easily, reliably, and repeatably deploy your full-stack applications.  Adapt specifications look like [React](https://reactjs.org) apps, but instead of rendering browser DOM elements like `<input>`, or `<div>`, Adapt specifications use elements like AWS `<EC2Instance>`, Kubernetes `<Pod>`, or `<MongoDB>` database.

If you're already familiar with React, you'll feel right at home with Adapt.
But if not, don't worry, knowledge of React isn't required to start using Adapt.

## Getting Started
For a new project, it's easy to get started with Adapt by using a starter template.
The [Getting Started Guide](https://adaptjs.org/docs/getting_started) will walk through installing Adapt and deploying your first starter app.

## Creating and deploying an app
This example creates a new full-stack app from a starter template.
It has a [React](https://reactjs.org) UI, an [Nginx](https://nginx.org) web server, a [Node.js](https://nodejs.org) API server, and a [Postgres](https://postgresql.org) database, then deploys it to [Kubernetes](https://kubernetes.io/):
```bash
# Install adapt
npm install -g @adpt/cli

# Create a new app from a starter template
adapt new hello-react-node-postgres ./myapp
cd myapp/deploy

# Deploy to Kubernetes using "k8s" style sheet
adapt run k8s
```

The Adapt description for the complete app stack looks like this:
```jsx
import Adapt from "@adpt/core";
import { NodeService, ReactApp } from "@adpt/cloud/nodejs";
import { Postgres } from "@adpt/cloud/postgres";

function MyApp() {
  const pg = Adapt.handle();

  return (
    <Adapt.Group>
      <ReactApp srcDir="../frontend" />
      <NodeService srcDir="../backend" connectTo={pg} />
      <Postgres handle={pg} />
    </Adapt.Group>
  );
}
```

## Adapt in action
This demo shows using Adapt to create and deploy a simple app called MovieDB that has a [React](https://reactjs.org) UI, an [Nginx](https://nginx.org) web server, an Nginx URL router, a [Node.js](https://nodejs.org) API server, and a [Postgres](https://postgresql.org) database, then deploys it to [Kubernetes](https://kubernetes.io/):

![Adapt in action](https://adaptjs.org/docs/assets/getting_started/adapt-demo-scaled.gif)

## More info
* [Adaptjs.org](https://adaptjs.org)

    Learn more about Adapt.

* [Getting Started Guide](https://adaptjs.org/docs/getting_started)

    This guide will walk you through setting up Adapt and then deploying an example MovieDB app.

* [Adapt Documentation](https://adaptjs.org/docs)

    Adapt tutorials, API References, and more.

## Getting Help
[![Gitter](https://badges.gitter.im/UnboundedSystems/Adapt.svg)](https://gitter.im/UnboundedSystems/Adapt)

We'd love to hear about your experience with Adapt!
Join us on our [Gitter channel](https://gitter.im/UnboundedSystems/Adapt) to ask questions or to give us your feedback and suggestions.

If you've found a bug, you can also [file an issue](https://gitlab.com/unboundedsystems/adapt/issues).

## Command Reference
<!-- commands -->
* [`adapt autocomplete [SHELL]`](#adapt-autocomplete-shell)
* [`adapt deploy:destroy DEPLOYID`](#adapt-deploydestroy-deployid)
* [`adapt deploy:list`](#adapt-deploylist)
* [`adapt deploy:run [STACKNAME]`](#adapt-deployrun-stackname)
* [`adapt deploy:status DEPLOYID`](#adapt-deploystatus-deployid)
* [`adapt deploy:update DEPLOYID [STACKNAME]`](#adapt-deployupdate-deployid-stackname)
* [`adapt help [COMMAND]`](#adapt-help-command)
* [`adapt project:new STARTER [DIRECTORY]`](#adapt-projectnew-starter-directory)

## `adapt autocomplete [SHELL]`

display autocomplete installation instructions

```
USAGE
  $ adapt autocomplete [SHELL]

ARGUMENTS
  SHELL  shell type

OPTIONS
  -r, --refresh-cache  Refresh cache (ignores displaying instructions)

EXAMPLES
  $ adapt autocomplete
  $ adapt autocomplete bash
  $ adapt autocomplete zsh
  $ adapt autocomplete --refresh-cache
```

_See code: [@unboundedsystems/plugin-autocomplete](https://github.com/oclif/plugin-autocomplete/blob/v0.1.0-unb2/src/commands/autocomplete/index.ts)_

## `adapt deploy:destroy DEPLOYID`

Destroy an existing deployment of an Adapt project

```
USAGE
  $ adapt deploy:destroy DEPLOYID

OPTIONS
  -d, --debug=debugFlags  Enable additional debug output. Should be a comma-separated list of debug flags. Valid debug
                          flags are: build

  -q, --quiet             Suppress status output messages. Still outputs any result output.

  --dryRun                Show what would happen during deploy, but do not modify the deployment

  --registry=registry     URL of alternate NPM registry to use

  --rootFile=rootFile     [default: index.tsx] Project description file to deploy (.ts or .tsx)

  --serverUrl=serverUrl   URL of Adapt server. Defaults to using local system.

ALIASES
  $ adapt destroy

EXAMPLE

  Destroy the deployment "myproj-dev-abcd" using the default project description file, "index.tsx":
       $ adapt deploy:destroy myproj-dev-abcd
```

_See code: [dist/src/commands/deploy/destroy.js](https://github.com/unboundedsystems/adapt/blob/v0.0.6/dist/src/commands/deploy/destroy.js)_

## `adapt deploy:list`

List active Adapt deployments

```
USAGE
  $ adapt deploy:list

OPTIONS
  -d, --debug=debugFlags  Enable additional debug output. Should be a comma-separated list of debug flags. Valid debug
                          flags are: build

  -q, --quiet             Suppress status output messages. Still outputs any result output.

  --rootFile=rootFile     [default: index.tsx] Project description file to deploy (.ts or .tsx)

  --serverUrl=serverUrl   URL of Adapt server. Defaults to using local system.

ALIASES
  $ adapt list

EXAMPLE
  List all deployments from the server
       $ adapt deploy:list
```

_See code: [dist/src/commands/deploy/list.js](https://github.com/unboundedsystems/adapt/blob/v0.0.6/dist/src/commands/deploy/list.js)_

## `adapt deploy:run [STACKNAME]`

Create a new deployment for an Adapt project

```
USAGE
  $ adapt deploy:run [STACKNAME]

ARGUMENTS
  STACKNAME  [default: default] Name of the stack you wish to run

OPTIONS
  -d, --debug=debugFlags  Enable additional debug output. Should be a comma-separated list of debug flags. Valid debug
                          flags are: build

  -q, --quiet             Suppress status output messages. Still outputs any result output.

  --deployID=deployID     A fixed deployID to use for this deployment. Will error if the specified deployID already
                          exists.

  --dryRun                Show what would happen during deploy, but do not modify the deployment

  --registry=registry     URL of alternate NPM registry to use

  --rootFile=rootFile     [default: index.tsx] Project description file to deploy (.ts or .tsx)

  --serverUrl=serverUrl   URL of Adapt server. Defaults to using local system.

ALIASES
  $ adapt run

EXAMPLES
  Deploy the stack named "default" from the default project description file, index.tsx:
       $ adapt deploy:run

  Deploy the stack named "dev" from the default project description file, index.tsx:
       $ adapt deploy:run dev

  Deploy the stack named "dev" from an alternate description file:
       $ adapt deploy:run --rootFile somefile.tsx dev
```

_See code: [dist/src/commands/deploy/run.js](https://github.com/unboundedsystems/adapt/blob/v0.0.6/dist/src/commands/deploy/run.js)_

## `adapt deploy:status DEPLOYID`

Fetch the status of an existing deployment of an Adapt project

```
USAGE
  $ adapt deploy:status DEPLOYID

OPTIONS
  -d, --debug=debugFlags  Enable additional debug output. Should be a comma-separated list of debug flags. Valid debug
                          flags are: build

  -q, --quiet             Suppress status output messages. Still outputs any result output.

  --dryRun                Show what would happen during deploy, but do not modify the deployment

  --registry=registry     URL of alternate NPM registry to use

  --rootFile=rootFile     [default: index.tsx] Project description file to deploy (.ts or .tsx)

  --serverUrl=serverUrl   URL of Adapt server. Defaults to using local system.

ALIASES
  $ adapt status

EXAMPLES
  Fetch the status of deployment "myproj-dev-abcd" from the default project description file, "index.tsx":
       $ adapt deploy:status myproj-dev-abcd

  Fetch the status of deployment "myproj-dev-abcd" from an alternate description file, "somefile.tsx":
       $ adapt deploy:status --rootFile somefile.tsx myproj-dev-abcd
```

_See code: [dist/src/commands/deploy/status.js](https://github.com/unboundedsystems/adapt/blob/v0.0.6/dist/src/commands/deploy/status.js)_

## `adapt deploy:update DEPLOYID [STACKNAME]`

Update an existing deployment of an Adapt project

```
USAGE
  $ adapt deploy:update DEPLOYID [STACKNAME]

OPTIONS
  -d, --debug=debugFlags  Enable additional debug output. Should be a comma-separated list of debug flags. Valid debug
                          flags are: build

  -q, --quiet             Suppress status output messages. Still outputs any result output.

  --dryRun                Show what would happen during deploy, but do not modify the deployment

  --registry=registry     URL of alternate NPM registry to use

  --rootFile=rootFile     [default: index.tsx] Project description file to deploy (.ts or .tsx)

  --serverUrl=serverUrl   URL of Adapt server. Defaults to using local system.

ALIASES
  $ adapt update

EXAMPLES
  Update the deployment "myproj-dev-abcd", from the default project description file, "index.tsx":
       $ adapt deploy:update myproj-dev-abcd

  Update the deployment "myproj-dev-abcd", using the stack named "dev" from an alternate description file, 
  "somefile.tsx":
       $ adapt deploy:update --rootFile somefile.tsx myproj-dev-abcd dev
```

_See code: [dist/src/commands/deploy/update.js](https://github.com/unboundedsystems/adapt/blob/v0.0.6/dist/src/commands/deploy/update.js)_

## `adapt help [COMMAND]`

display help for adapt

```
USAGE
  $ adapt help [COMMAND]

ARGUMENTS
  COMMAND  command to show help for

OPTIONS
  --all  see all commands in CLI
```

_See code: [@unboundedsystems/plugin-help](https://github.com/oclif/plugin-help/blob/v2.1.6-unb1/src/commands/help.ts)_

## `adapt project:new STARTER [DIRECTORY]`

Create a new Adapt project

```
USAGE
  $ adapt project:new STARTER [DIRECTORY]
  $ adapt project:new STARTER DIRECTORY [STARTER_ARGS...]

ARGUMENTS
  STARTER    Adapt starter to use. May be the name of a starter from the starter gallery, a URL, a local file path, or
             most formats supported by npm.

  DIRECTORY  [default: .] Directory where the new project should be created. The directory will be created if it does
             not exist.

OPTIONS
  -q, --quiet                                        Suppress status output messages. Still outputs any result output.

  --adaptVersion=adaptVersion                        [default: <adapt CLI version>] Attempt to select a starter that is
                                                     compatible with this version of Adapt. Must be a valid semver.

  --sshHostKeyCheck=yes|no|ask|accept-new|off|unset  [default: yes] Sets the ssh StrictHostKeyChecking option when using
                                                     the ssh protocol for fetching a starter from a remote git
                                                     repository. Defaults to 'yes' if OpenSSH is detected, 'unset'
                                                     otherwise.

ALIASES
  $ adapt new

EXAMPLE
  Create a new project into the directory './myproj' using the starter named 'blank' from the Adapt starter gallery:
       $ adapt project:new blank myproj
```

_See code: [dist/src/commands/project/new.js](https://github.com/unboundedsystems/adapt/blob/v0.0.6/dist/src/commands/project/new.js)_
<!-- commandsstop -->

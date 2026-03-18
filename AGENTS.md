\# Agents.md: JS-SDK Binary Wrapper



This document outlines the configuration required to transform a JavaScript SDK into a standalone, extension-less terminal command.



\## 1. Project Architecture

To ensure the tool is recognized as a command, the project must follow this structure:

\* `bin/` - Contains the entry point script.

\* `src/` - Contains your JS-SDK logic.

\* `package.json` - Defines the command name and dependencies.



\## 2. The Entry Script (`bin/cli.js`)

The "Shebang" line at the top is mandatory. It tells Windows and Unix systems to execute this file using Node.js.



```javascript

\#!/usr/bin/env node



// Import your locked JS-SDK

const sdk = require('../src/index.js');



// Capture CLI arguments

const args = process.argv.slice(2);



async function run() {

&#x20;   console.log("--- JS-SDK Agent Active ---");

&#x20;   try {

&#x20;       // Example: Passing arguments to your SDK

&#x20;       await sdk.init(args);

&#x20;   } catch (err) {

&#x20;       console.error("Agent Error:", err.message);

&#x20;       process.exit(1);

&#x20;   }

}



run();

```



\## 3. The manifest (`package.json`)

This is where the "extension-less" magic happens. The `bin` object maps your desired command name to the script file.



```json

{

&#x20; "name": "my-agent-tool",

&#x20; "version": "1.0.0",

&#x20; "description": "JS-SDK locked to a binary command",

&#x20; "main": "src/index.js",

&#x20; "bin": {

&#x20;   "agent": "./bin/cli.js"

&#x20; },

&#x20; "dependencies": {

&#x20;   "your-js-sdk": "^1.0.0"

&#x20; }

}

```



\## 4. Installation \& Locking

To register the command `agent` on your system so you can run it from any folder in CMD or PowerShell:



1\.  \*\*Navigate\*\* to your project root.

2\.  \*\*Run\*\* the link command:

&#x20;   ```bash

&#x20;   npm link

&#x20;   ```

3\.  \*\*Verify\*\*: Type `agent` in your terminal. npm will have created a shim (no extension) that points to your Node script.



\## 5. Deployment (No-Node Environment)

If you need to distribute this to a machine \*\*without Node.js\*\*, use a compiler to lock the environment into a single `.exe`:



\* \*\*Tool\*\*: \[Pkg](https://www.npmjs.com/package/pkg)

\* \*\*Command\*\*: `npx pkg . --targets node16-win-x64 --output agent.exe`


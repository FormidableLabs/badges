## Install

Clone the repository:

```sh
git clone https://github.com/FormidableLabs/badges.git
cd badges
```

Install dependencies. Note that one of the dependencies is
[node-canvas](https://github.com/Automattic/node-canvas), which has system
requirements that must be satisfied outside of npm.

```sh
npm install
```

The file `Verdana.ttf` should ideally exist in the root of the repository
(it’s used as the default font for measuring text width). But we can’t
distribute it due to licensing, so you should place the file there yourself.
A helper command is included:

```sh
npm run add-font
```

Then start the server:

```sh
npm run start
```

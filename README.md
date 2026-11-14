# Weg

A free Windows desktop app that takes an international student in Germany from zero to a passed B1 certificate, and on to C1. One fixed path of 11 sublevels, one daily session, and progress judged only by exam-format gate tests.

Weg is in early development: the app shell, the content schemas and the build pipeline exist; the learning engine and the curriculum are being built. Gate results are practice scores, not certificates.

- [North star](docs/north-star.md): what the finished app is
- [Build plan](docs/build-plan.md): who builds what
- [Architecture](docs/ARCHITECTURE.md) and [decision records](docs/adr/)
- [CLAUDE.md](CLAUDE.md): the rules every contributor and agent follows

## Run it

Needs Node.js 20 or newer, Rust (stable) and the Visual Studio C++ build tools.

```bash
npm install
```

```bash
npm run tauri dev
```

## Check a change

```bash
npm run check
```

This runs lint, the type check, the tests and the content validation. CI runs the same, plus the Windows build.

## Licence

Code: MIT. Content sources and their licences are listed in each content file and in [CLAUDE.md](CLAUDE.md).

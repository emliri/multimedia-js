# External (modified) (sub)modules

Here keep soft fork references to libs that we wrap our own version of.

The goal is however to stay inline with the upstream repos as possible.

**IMPORTANT: We don't want to have to build these dependencies or use their actual distro**

**BUT: Make them part of our source-tree and compile them via our first tier build system as such**

Only `codem-isoboxer` makes this hard since it is declared on an injected scope and doesn't use UMD-compliant modules.

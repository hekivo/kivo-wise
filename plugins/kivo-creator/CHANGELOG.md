# Changelog

## 0.1.0 (2026-10-19)


### Features

* **kivo-creator:** add a pixel diff with a size-aware ratio ([e3fe4df](https://github.com/hekivo/kivo-wise/commit/e3fe4dfc2ed6ce0d04ac700f72ff931a7b698e75))
* **kivo-creator:** add kivo-creator with Figma ingest and the three Roots adapters (phases 1-3) ([4045a2f](https://github.com/hekivo/kivo-wise/commit/4045a2f672c1d4c1b4a5a5712b468c5d73ca6724))
* **kivo-creator:** add spec checks, option parsing and the validate-spec CLI ([d331bd7](https://github.com/hekivo/kivo-wise/commit/d331bd78b99f648ee9d8f08a27af4aef59d0923a))
* **kivo-creator:** add the /creator command skill that stops at the match plan ([256e873](https://github.com/hekivo/kivo-wise/commit/256e8735702ccb60c3d00b60bc3708dc52571f21))
* **kivo-creator:** add the code-connect skill that sends only after approval ([fef3c5f](https://github.com/hekivo/kivo-wise/commit/fef3c5fade3c2420f7f6e5ecda8c3c94f0db02f6))
* **kivo-creator:** add the figma-ingest skill ([6ba72d3](https://github.com/hekivo/kivo-wise/commit/6ba72d3d532996b332b07f1116c72aa0bae6e2ef))
* **kivo-creator:** add the html-ingest and section-matching skills ([7c58f80](https://github.com/hekivo/kivo-wise/commit/7c58f801bbd6a992c68e90ebe057bdfc697d1315))
* **kivo-creator:** add the plugin skeleton and manifests ([b5351c3](https://github.com/hekivo/kivo-wise/commit/b5351c381a84d89aae8b75f27eea6656547ae5a4))
* **kivo-creator:** add the radicle adapter ([19186b6](https://github.com/hekivo/kivo-wise/commit/19186b6ee2100b7ae5f63afec5391edfe9a2162b))
* **kivo-creator:** add the sage-theme adapter ([5987d25](https://github.com/hekivo/kivo-wise/commit/5987d2530d3e01b41abe8ddeb7aa3161016a5b3b))
* **kivo-creator:** add the scaffolding and visual fidelity skills ([492debc](https://github.com/hekivo/kivo-wise/commit/492debc2c6144db8377680ccfd92f2bdbddf5da4))
* **kivo-creator:** add the section spec schema and validator ([2d0c404](https://github.com/hekivo/kivo-wise/commit/2d0c4045317810c5426eac5bb186ec056d5cfe23))
* **kivo-creator:** add the slot-to-field compatibility filter ([37ff8aa](https://github.com/hekivo/kivo-wise/commit/37ff8aaee51278d9648fa3a33df45b77fd77880e))
* **kivo-creator:** build and check the match plan ([a53a7cb](https://github.com/hekivo/kivo-wise/commit/a53a7cbea77e6c3cbcb192c5614d7ce269a30a88))
* **kivo-creator:** build the fidelity verdict and report ([f02d919](https://github.com/hekivo/kivo-wise/commit/f02d919dad5e8aea1b1b0f2fe0acb7e7a645fe09))
* **kivo-creator:** check exact design values against computed styles ([304d05c](https://github.com/hekivo/kivo-wise/commit/304d05cbe19b0204272f272b84d6ab091e006063))
* **kivo-creator:** classify section kinds with documented heuristics ([c9969c9](https://github.com/hekivo/kivo-wise/commit/c9969c93c395d270ec4f6310d0a167cdb93738bf))
* **kivo-creator:** create run folders under .creator ([2d14902](https://github.com/hekivo/kivo-wise/commit/2d149027202d79263cdee14655f738ed9a711548))
* **kivo-creator:** decode and encode PNG with node:zlib only ([b83ab54](https://github.com/hekivo/kivo-wise/commit/b83ab54b380bfd8e5361487311dd983a5502b3e4))
* **kivo-creator:** define the adapter contract ([c936ab1](https://github.com/hekivo/kivo-wise/commit/c936ab16955ed6706f232a22984f09b209eca944))
* **kivo-creator:** download Figma reference images for the pixel diff ([cc98e7c](https://github.com/hekivo/kivo-wise/commit/cc98e7ca3d229799d0af78ccda92453d4b570d29))
* **kivo-creator:** emit acf block markup from the acorn-mu-plugin adapter ([ba2def3](https://github.com/hekivo/kivo-wise/commit/ba2def356a96a4cc3ea3bd6c03096daddc57d353))
* **kivo-creator:** emit and scaffold native block.json blocks ([0403c85](https://github.com/hekivo/kivo-wise/commit/0403c8559672c119a63fc239622c420652e5560c))
* **kivo-creator:** emit page markup and scaffolded blocks into the run folder ([02fdb63](https://github.com/hekivo/kivo-wise/commit/02fdb6339cb907d7d65c331a0d263d474f2c8ac3))
* **kivo-creator:** extract slots, layout and tokens into a section spec ([12bf359](https://github.com/hekivo/kivo-wise/commit/12bf359038de0110f437e5ddf6bbef21a2c7ad29))
* **kivo-creator:** fall back to nl2br(e()) when the project has no [@textarea](https://github.com/textarea) directive ([61bfee3](https://github.com/hekivo/kivo-wise/commit/61bfee32b5a780761b90d4e60fba9a504e713033))
* **kivo-creator:** ingest an HTML page into section specs and references ([67bdf9b](https://github.com/hekivo/kivo-wise/commit/67bdf9bd5b3e1b2f1c710f3f28e162a8f92a7a8e))
* **kivo-creator:** lint generated markup for arbitrary values and inline styles ([6bbf157](https://github.com/hekivo/kivo-wise/commit/6bbf15799561ab52deb75e0033be1b6cf64835d6))
* **kivo-creator:** load the target project's Playwright and collect DOM snapshots ([b92f29f](https://github.com/hekivo/kivo-wise/commit/b92f29fafcb242eaf9f7e0bb7ba1764ae7cf32a6))
* **kivo-creator:** map design values to [@theme](https://github.com/theme) tokens and propose the rest ([835eb56](https://github.com/hekivo/kivo-wise/commit/835eb56ea36d231b370919203a9992383a01b38e))
* **kivo-creator:** new blocks follow the project's existing block type ([ec04892](https://github.com/hekivo/kivo-wise/commit/ec04892fda0e8ee473936b3895f24be635e324ab))
* **kivo-creator:** propose Code Connect mappings from the catalog ([ea6adcd](https://github.com/hekivo/kivo-wise/commit/ea6adcdeb6eb6ad30d2c54b8378188953a6a9e84))
* **kivo-creator:** read native block.json blocks into the catalog ([4994516](https://github.com/hekivo/kivo-wise/commit/4994516b607b525a824089ff5225e5089649cbaf))
* **kivo-creator:** read the ACF Composer block catalog ([55cc24c](https://github.com/hekivo/kivo-wise/commit/55cc24ca1916d347d5d64f96cebdf1a0e9a10654))
* **kivo-creator:** resolve the target stack from kivo-wise ([1a925b1](https://github.com/hekivo/kivo-wise/commit/1a925b17541b5d3001a0051c2c2b637cb2bd0531))
* **kivo-creator:** scaffold missing ACF Composer blocks in the project's conventions ([0987813](https://github.com/hekivo/kivo-wise/commit/09878135f38be3f08965be84f041e24d59a6bbb1))
* **kivo-creator:** segment a DOM snapshot into page sections ([96d4a86](https://github.com/hekivo/kivo-wise/commit/96d4a86f44719aed24f6921296188e1ba65a0df2))
* **kivo-creator:** serialise block markup like WordPress core ([3d9276d](https://github.com/hekivo/kivo-wise/commit/3d9276d561d5b8292a8cb00721d11727ac018eb7))
* **kivo-creator:** take the section selector from the adapter, overridable per project ([dfe3676](https://github.com/hekivo/kivo-wise/commit/dfe36768c83c7abdd36501f54cfcc8da65a1e2ec))
* **kivo-creator:** turn Figma metadata into section skeletons ([af56650](https://github.com/hekivo/kivo-wise/commit/af56650d315a4d0ef7c9fe5822e23c1900c1b4cf))
* **kivo-creator:** verify rendered sections with pixel diff, style check and lint ([e79e5ca](https://github.com/hekivo/kivo-wise/commit/e79e5ca4f44d9321384db5daa3f00b51fb8b0125))


### Bug Fixes

* **kivo-creator:** derive the default block slug the way ACF Composer does ([e04cdd2](https://github.com/hekivo/kivo-wise/commit/e04cdd229457d7cdf11fb048566e40125ab2d673))


### Documentation

* **kivo-creator:** add the README and provenance for the core ([1b4d3ae](https://github.com/hekivo/kivo-wise/commit/1b4d3aef48bd3a55f9331f73c608b9082b1724f2))
* **kivo-creator:** document the block type rule for new blocks ([70cf07d](https://github.com/hekivo/kivo-wise/commit/70cf07daf01b38cb6c23f8316294dc89414153bc))
* **kivo-creator:** document the sage-theme and radicle adapters ([aa05ccb](https://github.com/hekivo/kivo-wise/commit/aa05ccb345f49a39f8a9eac8b33d222f514a3cd8))
* **kivo-creator:** record the phase 2 and 3 deviations and the Figma token requirement ([3e2d058](https://github.com/hekivo/kivo-wise/commit/3e2d058cf92ece2cc18aa99fe9c0bebb6b9abc5d))

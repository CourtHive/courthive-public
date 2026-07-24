# Changelog

## [1.9.0](https://github.com/CourtHive/courthive-public/compare/v1.8.1...v1.9.0) (2026-07-24)


### Features

* **hiveid:** enable federation-id capture on the login/signup modal ([4a60ce5](https://github.com/CourtHive/courthive-public/commit/4a60ce5bbca787ebeba6039102e7f07f81a3a68f))
* **me:** player availability collection surface ([c205bdf](https://github.com/CourtHive/courthive-public/commit/c205bdf7015e77e34b9da41338bc93e8408369d1))
* **me:** read + withdraw registrations from declarations, off the mutation server ([e419af3](https://github.com/CourtHive/courthive-public/commit/e419af352be00711e86f092ebfa1495ff7249725))
* **me:** source the availability provider picker from my providers (off CFS) ([ff39952](https://github.com/CourtHive/courthive-public/commit/ff3995255d9f941de608eb6ef26927cec6d377e9))
* **partner-invite:** confirm-landing page + route for the invitee ([86568e4](https://github.com/CourtHive/courthive-public/commit/86568e41c2b8c46fb94b037078f840c7960d0917))
* **partner-invite:** declarations client methods + partnerInviteId on payload ([9fd412f](https://github.com/CourtHive/courthive-public/commit/9fd412fd950b307d34a0aaa41e99dab62532b575))
* **partner-invite:** nominate a doubles partner on the register page ([b2ca660](https://github.com/CourtHive/courthive-public/commit/b2ca660192601f392c299f602f7e9d430a9b4989))
* **register:** inline create-account with consent-gated dob/sex on the proposal page ([1bfb3ec](https://github.com/CourtHive/courthive-public/commit/1bfb3ec4b4f2ee780c24b539d8a92ddeef554518))
* **register:** proposal registration page (sanctioning-proposal-driven) ([98ea787](https://github.com/CourtHive/courthive-public/commit/98ea7877147c27653e8d2d2b93f8ac7af75e484d))
* **register:** store stable eventId (fallback to name) for proposal registration ([26065df](https://github.com/CourtHive/courthive-public/commit/26065df7e1850057a912b24e37a8649c41814509))
* **registration:** consolidate info-tab cta to /register; existing-check via declarations ([369584a](https://github.com/CourtHive/courthive-public/commit/369584a0c6824502f01fcfdcee8a78ffccc68681))
* **scoring-launch:** hand off HiveID identity to the launched scorer ([d430cf1](https://github.com/CourtHive/courthive-public/commit/d430cf1c259b89098f21714a75993ff219bd06c7))
* **scoring:** hand epixodic a scoped score token, not the session jwt ([db5671e](https://github.com/CourtHive/courthive-public/commit/db5671e282f46b6ec35c380897e66d8814f08b5a))


### Bug Fixes

* **deps:** drop unused vitest-github-actions-reporter to clear undici advisories ([1f7ce3f](https://github.com/CourtHive/courthive-public/commit/1f7ce3f3aa0781157e4fe78dae361160939e7a8b))
* **deps:** override vulnerable transitive dep to clear audit high ([cd8e0f4](https://github.com/CourtHive/courthive-public/commit/cd8e0f45093cf79a8ab3358793905f0c1a4fe37d))
* **deps:** update courthive-components to 3.11.0 ([00c1941](https://github.com/CourtHive/courthive-public/commit/00c1941f02cd301fdcca51f82ff28f44c7d34a22))
* **deps:** update tods-competition-factory to 6.10.0 ([55a1ed8](https://github.com/CourtHive/courthive-public/commit/55a1ed832e33eb22f390eb41ac3c785c441fd422))
* **deps:** update tods-competition-factory to 6.11.0 ([e9c1e44](https://github.com/CourtHive/courthive-public/commit/e9c1e4400d44317f55a5826299083a377278512b))
* **deps:** update tods-competition-factory to 6.12.0 ([90e6dfd](https://github.com/CourtHive/courthive-public/commit/90e6dfd89efe143d9e94a370db17ed837237039e))
* **me:** default declarations base url to port 3120 ([2fea7a7](https://github.com/CourtHive/courthive-public/commit/2fea7a730c1f90c88d84b067a5fa15e0414928c2))
* **me:** honor server session validity, add navbar sign-out + provider picker ([380a63b](https://github.com/CourtHive/courthive-public/commit/380a63b0e3875443b82ad7cba656cc917779c1d8))
* **me:** point provider picker at CFS + let users edit an unverified email ([b83f0cd](https://github.com/CourtHive/courthive-public/commit/b83f0cda6499c526d46b669f36209a23e62dabe9))


### Documentation

* reflect registration migration off cfs to declarations ([fa71442](https://github.com/CourtHive/courthive-public/commit/fa714428ef93f8693623d1c431146791200bec48))

## [1.8.1](https://github.com/CourtHive/courthive-public/compare/v1.8.0...v1.8.1) (2026-07-14)


### Bug Fixes

* **crowd:** connect /crowd via /relay/socket.io/ path in production ([d4472bc](https://github.com/CourtHive/courthive-public/commit/d4472bc81de45bcd6ab663dd2772ae8786513ab5))
* **deps:** pin typescript to 6.0.3 to block native ts7 ([656471a](https://github.com/CourtHive/courthive-public/commit/656471ae682578810134abe643efbbf564caf99d))
* **deps:** update tods-competition-factory to 6.2.0 ([43db5d7](https://github.com/CourtHive/courthive-public/commit/43db5d76b017b497de362b07c079a369bad940e9))
* **deps:** update tods-competition-factory to 6.3.0 ([a771144](https://github.com/CourtHive/courthive-public/commit/a771144b01cea37bdb6d23567145d28e96aa4a12))
* **deps:** update tods-competition-factory to 6.4.0 ([c5491c2](https://github.com/CourtHive/courthive-public/commit/c5491c2f44bc10a63a987d4bb69472d1ef9d9b6b))
* **deps:** update tods-competition-factory to 6.5.0 ([649d80f](https://github.com/CourtHive/courthive-public/commit/649d80f3eb5c25e8632833b5db1474b9612844b4))
* **deps:** update tods-competition-factory to 6.6.0 ([3fdb5b5](https://github.com/CourtHive/courthive-public/commit/3fdb5b58bfeb396a829a00dc15c27e2fbe4d95ca))
* **deps:** update tods-competition-factory to 6.7.0 ([f38a096](https://github.com/CourtHive/courthive-public/commit/f38a0964a467e2e1ece3ccad89e0e93a8b6f65c6))
* **tournament:** render splash dates as calendar days (timezone-independent) ([#447](https://github.com/CourtHive/courthive-public/issues/447)) ([e03eaf5](https://github.com/CourtHive/courthive-public/commit/e03eaf525f3ca03828ba99ab5db31f615a351fce))

## [1.8.0](https://github.com/CourtHive/courthive-public/compare/v1.7.0...v1.8.0) (2026-07-04)


### Features

* **rankings:** consume provider-scoped rankings API ([#438](https://github.com/CourtHive/courthive-public/issues/438)) ([5a65397](https://github.com/CourtHive/courthive-public/commit/5a65397121679d356c4bfa3ffcce82a198e8727d))
* **scoring:** per-matchUp launch menu and email verification ui ([4ecd878](https://github.com/CourtHive/courthive-public/commit/4ecd8789eef6d28e3bfa5831635f2ea6dabb8153))


### Bug Fixes

* **api:** use VITE_SERVER before hardcoded courthive.net fallback ([#356](https://github.com/CourtHive/courthive-public/issues/356)) ([829a4d0](https://github.com/CourtHive/courthive-public/commit/829a4d0ca116fa85b6aa2d0ff67fa6c35bc24f52))
* **build:** add explicit src alias for vite 8.1.0 svelte resolution ([990902f](https://github.com/CourtHive/courthive-public/commit/990902f2ba6d4bd4c355888eb6d0a564329130a5))
* **deps:** update courthive-components to 3.4.4 ([e314e64](https://github.com/CourtHive/courthive-public/commit/e314e64e170fd1fbc58350caed926716e4f8c306))
* **deps:** update tods-competition-factory to 5.6.0 ([9d0b9c2](https://github.com/CourtHive/courthive-public/commit/9d0b9c2ae331f72efb504afc9943a1bfbfa8e12c))
* **deps:** update tods-competition-factory to 5.7.0 ([af2a92a](https://github.com/CourtHive/courthive-public/commit/af2a92a841bffc91872193f29c56bf332fc2867b))
* **deps:** update tods-competition-factory to 5.7.1 ([ddb0981](https://github.com/CourtHive/courthive-public/commit/ddb09810d9702fe60dbe486fbbd32b1e161ef455))


### Documentation

* refresh CLAUDE.md for hiveid, rankings, and scoring launch ([67905dd](https://github.com/CourtHive/courthive-public/commit/67905dd01196efcf529ce2efecce3073d7c75a70))

## [1.7.0](https://github.com/CourtHive/courthive-public/compare/v1.6.1...v1.7.0) (2026-06-08)


### Features

* **build:** emit dist/version.json so /pub/version.json returns real JSON ([faf40a1](https://github.com/CourtHive/courthive-public/commit/faf40a1dbdedb7b22975b211b63afc4173c371d3))
* **rankings:** add /rankings/:providerAbbr route + BOBOCA demo page ([95f3ff9](https://github.com/CourtHive/courthive-public/commit/95f3ff94adcc71978857538b473219394657ba77))
* **rankings:** fetch /api/rankings/bundle live with static fallback ([5ebd10c](https://github.com/CourtHive/courthive-public/commit/5ebd10ca31b37bbad488845d8ade90832b1226e3))
* **rankings:** provider-agnostic landing at /#/rankings ([e89bdd6](https://github.com/CourtHive/courthive-public/commit/e89bdd68ac9ac605f413cf43df1335c1dda22bb9))
* **rankings:** refresh BOBOCA JSON with canonical UUID personIds ([73b726c](https://github.com/CourtHive/courthive-public/commit/73b726cbb29ee6716f414a5a8a6c92bfb995fbc7))
* **rankings:** refresh BOBOCA rankings with all 12 tournaments ([c789812](https://github.com/CourtHive/courthive-public/commit/c7898120c646cfaae0ca1d6be750e513ba81b600))
* **rankings:** use rescued LadderChart in per-player expansion ([df69ec9](https://github.com/CourtHive/courthive-public/commit/df69ec95c1cf40f8af995758703845f45f6bc578))


### Bug Fixes

* **deps:** update tods-competition-factory to 5.3.0 ([872c505](https://github.com/CourtHive/courthive-public/commit/872c50526237d48808d926605eeaa7e59a836d70))
* **deps:** update tods-competition-factory to 5.4.0 ([e828ba4](https://github.com/CourtHive/courthive-public/commit/e828ba4c00455365b3ac49ecd9bb6b1db501d26c))
* **rankings:** policy methodology is per-provider, not universal ([e2bb32c](https://github.com/CourtHive/courthive-public/commit/e2bb32c2bc005abb7f631d247c0a7b9865e661e7))

## [1.6.1](https://github.com/CourtHive/courthive-public/compare/v1.6.0...v1.6.1) (2026-06-02)


### Documentation

* **readme:** bump prereq floors and fix factory repo link ([4eb1232](https://github.com/CourtHive/courthive-public/commit/4eb1232caf04894a3180691e74b2557c9afed6cc))

## [1.6.0](https://github.com/CourtHive/courthive-public/compare/v1.5.0...v1.6.0) (2026-06-01)


### Features

* **branding:** per-provider runtime CSS theming + token-ify hardcoded link colors ([cad3a96](https://github.com/CourtHive/courthive-public/commit/cad3a9649e5d162c16a3123b942ba84a6d43098f))
* **crowd:** attribute crowd scoring to a HiveID identity (hiveid phase 5) ([4601472](https://github.com/CourtHive/courthive-public/commit/4601472eab8b0b4e491be7185d33079f9a3eed43))
* **hiveid:** public registration submit form on tournament page (phase 2-A.1) ([64691b5](https://github.com/CourtHive/courthive-public/commit/64691b553f98098cc68136794ec8033f823cf875))
* **hiveid:** public-side login modal + My CourtHive route (PR-J) ([f57ceac](https://github.com/CourtHive/courthive-public/commit/f57ceac755a4846d91ce809506cbe7e15ab8cc8f))
* **hiveid:** real participations + claim UI on /me (PR-J.5) ([e1fc551](https://github.com/CourtHive/courthive-public/commit/e1fc5518fef2225a35c98d9b151c5d22ff131a91))
* **hiveid:** wire personUpdate dispatcher (Phase 4.0 MVP consumer) ([d0c3d91](https://github.com/CourtHive/courthive-public/commit/d0c3d918fdd56101829d97e54b34c310dde4ed81))
* **hiveid:** your-registrations section on /me (hiveid phase 2-A) ([314c5ea](https://github.com/CourtHive/courthive-public/commit/314c5ea9afc5a068fafb925810364cb95cfc7863))
* **me:** subscribe to personUpdate to refresh on canonical merge (Phase 4.0 MVP final wiring) ([1c1273f](https://github.com/CourtHive/courthive-public/commit/1c1273f12ceef79e003023d8f849705524eac91b))
* **players:** teams card-grid above the Players table ([c71e283](https://github.com/CourtHive/courthive-public/commit/c71e2838942d3fd6aee027dc508754aac99838c4))


### Bug Fixes

* **hiveid-socket:** per-attempt auth callback + connect_error visibility ([f7f770a](https://github.com/CourtHive/courthive-public/commit/f7f770a6007044eda603f259ec01a6505da10973))
* **me:** drop re-render storm + lazy listener cleanup on navigate-away ([8985aea](https://github.com/CourtHive/courthive-public/commit/8985aea699ec2d7fa801872203d9ce9075c1f7b2))
* **track:** themed cModal reset confirmation (no more browser dialog) ([af08bf6](https://github.com/CourtHive/courthive-public/commit/af08bf6c8473ce8ae0c3db6007c0d40bcaef7be9))

## [1.5.0](https://github.com/CourtHive/courthive-public/compare/v1.4.0...v1.5.0) (2026-05-24)


### Features

* **schedule:** replace Tabulator grid with schedule2 CSS grid and live strip ([f3cfffa](https://github.com/CourtHive/courthive-public/commit/f3cfffaefa813ccdaf19528e29a4c48ddd5b73aa))


### Bug Fixes

* **draws:** hide bracket connector lines on mobile ([6edb90b](https://github.com/CourtHive/courthive-public/commit/6edb90bfbabd341f3628493e0eebea8127f22cc6))
* **schedule:** make pinned column and Now spacer opaque ([e2c2ec9](https://github.com/CourtHive/courthive-public/commit/e2c2ec91ff918c3a8e870a099385ff34e5ec59c6))

## [1.4.0](https://github.com/CourtHive/courthive-public/compare/v1.3.0...v1.4.0) (2026-05-21)


### Features

* **tournament:** surface venues with image, address, and website link ([e5205b7](https://github.com/CourtHive/courthive-public/commit/e5205b73224d46bab4ed042ad76022d1d31ca2f7))


### Bug Fixes

* **deps:** update dependency tods-competition-factory to v4.0.0 ([aae385f](https://github.com/CourtHive/courthive-public/commit/aae385f1722dae38094561ee550ac5d4d4229df0))
* **tournament:** redirect on full unpublish + dedupe header buttons ([6277ea9](https://github.com/CourtHive/courthive-public/commit/6277ea95420a76717292bbb30e049bc0e353d548))

## [1.3.0](https://github.com/CourtHive/courthive-public/compare/v1.2.16...v1.3.0) (2026-05-18)


### Features

* **i18n:** migrate courthive-public to CFS-served locales ([76b2ddf](https://github.com/CourtHive/courthive-public/commit/76b2ddf95577a5b9a8d3de8d1eda47f653e7cf7b))

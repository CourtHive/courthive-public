# Changelog

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

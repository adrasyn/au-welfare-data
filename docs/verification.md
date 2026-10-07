# First release verification — 7 October 2026

The initial website contains nine payment groups, recipient units and estimated expenditure for 150 CED2024 electorates and 547 LGA2024 statistical council areas. Search is available at all sizes; no map is included in this receipt-first release.

## Checks completed

- 36 automated tests pass, including official source spot checks for Sydney electorate and Armidale council, suppressed counts, correspondence ratios, CRA subtotal exclusion, FTB component reconciliation, allocation metadata compatibility, pinned release links and the verified production origin.
- Clean installation and build pass without an existing cache directory.
- Sydney and Armidale render nine groups without horizontal overflow at 320, 375 and 430 pixels; desktop rendering was visually inspected at 1280 pixels. Postcode 0800 preserves its leading zero and returns multiple choices.
- Missing-population fixture: area selection renders counts and money, defaults to invoice, explains the missing denominator and disables receipt downloads. The fixture was removed.
- Receipt text shows per-resident amounts; invoice text shows annual area amounts. Both preserve source counts and units. Full text is exposed through a named disclosure associated with the preview image.
- Actual browser-generated receipt/invoice PNG and PDF files for Sydney and Armidale were inspected. PDFs contain one page at the intended paper size. The four preview graphics were pixel-identical after the review fixes. Hosting then assigned the final origin `https://benefits-data-australia.vvlsn.chatgpt.site`; share and QR links were updated to that verified URL, and the final four preview QR codes were decoded again against it.

Native in-app-browser saved-download events did not expose the generated file. A temporary local capture verified all eight generated files and was removed before publication. Generation and save-link behavior are verified; native save-dialog delivery still requires a user's ordinary browser. Physical-phone keyboard behavior and execution in a screen reader have not been tested. An independent reviewer checked data contracts, arithmetic and display/export agreement, but did not re-audit every national expenditure cell; the original source audit and two research reviews provide that evidence.

## Decisions carried from implementation

1. Initialise a dedicated development branch in the user's new project directory. There was no existing checkout to isolate. If this assumption were wrong, existing work could have been affected; inspection found no prior repository.
2. Follow the latest approved nine-group scope, including Parenting Payment and Carer Payment. This supersedes the earlier seven-group wording; a different intended scope would require removing those groups.
3. Show CRA separately and exclude its cross-program amount from subtotal addition because it is embedded in primary payments. The subtotal covers selected programmes, not all CRA-funded benefits or all welfare; treating it as a comprehensive total would be misleading.
4. Use FY2024–25 audited expenditure, June2025 recipient snapshots and June2024 resident population on matching 2024 boundaries. The denominator is explicitly dated; per-resident amounts may differ from results using newer populations.
5. Verify owner-private hosting through the native deployment result and preserve access. Production access and native download delivery were outside the reviewer’s pre-deployment review; an unsuccessful deployment must be reported, not assumed complete.
6. Retain responsive browser and semantic text checks while disclosing untested physical-phone keyboard and screen-reader execution. Device-specific behavior may still differ.
7. Rely on the documented original-source expenditure audit and research checks rather than repeating a full independent financial audit. A missed source transcription would change local allocations; source tables and checksums are retained for further audit.

## Final review fixes

Five important findings were reproduced and fixed in one pass: missing build-cache creation (clean build failure → success); unchecked count geography, snapshot date and spending period (three tests fail → pass); null population selection (browser crash → usable invoice); missing FTB component expenditure (test fails → reconciled components); and receipt values available only in the raster preview (missing text disclosure → matching accessible text). The whole automated suite passes, 35/35. No deferred minor findings remain.

Data sources, acquisition URLs, SHA256 hashes, correspondence provenance and allocation assumptions remain in `data/` and README. Source raw caches are excluded from deployment. No automatic refresh or public audience is configured.

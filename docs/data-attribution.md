# Data attribution

Every dataset is real, public and free to download. None is redistributed in this repository (`data/` is git-ignored); only small derived model files and summary numbers are committed. Nothing synthetic is used. The app's ageing models are NREL's (see below); the HUST, Naumann and Stanford rows describe our own laboratory fit, which is kept in the code but no longer shown. Licences are those stated by each source at download time; check the source before reusing a dataset.

| Dataset | Used for | Source | Licence |
|---|---|---|---|
| HUST LFP cycling (77 cells) | Cycle-ageing model and early-life cycle-life predictor | https://data.mendeley.com/datasets/nsc7hnsg4s | CC BY 4.0 |
| Naumann LFP calendar ageing (17 storage conditions) | Calendar-ageing model, cross-lab validation | https://data.mendeley.com/datasets/kxh42bfgtj | CC BY 4.0 |
| Stanford LFP calendar storage (80 cells) | Calendar-ageing model, cross-lab validation | https://osf.io/ju325/ | None declared; used here for coursework only |
| EVBattery field data (NMC-like, 464 vehicles) | Calibration method demonstration only; not part of the Prior | https://figshare.com/articles/dataset/23301881 | CC BY 4.0 |
| NASA POWER weather (four climate zones) | Ambient temperature by month for the climate zones | https://power.larc.nasa.gov/ | Open data, attribution required |

Required credit for the weather data: "These data were obtained from the NASA Langley Research Center (LaRC) POWER Project funded through the NASA Earth Science/Applied Science Program."

Notes on use
- The Stanford series has no declared licence. The project uses it for a non-commercial course assignment and does not republish it. Anyone reusing the project beyond that should contact the data's authors.
- EVBattery's authors state that values were perturbed, and its capacity labels are derived rather than measured. The chemistry is undisclosed and the cell voltage reaches 4.29 V, so it is treated as NMC-like and is never used to fit the LFP models.
- **NREL BLAST-Lite** (https://github.com/NatLabRockies/BLAST-Lite, version 1.1.3; previously github.com/NREL/BLAST-Lite) is the ageing engine of the app. `engine/reference/` is a Python port of the equations and parameters of its `Lfp_Gr_250AhPrismatic` and `Lfp_Gr_SonyMurata3Ah_Battery` models, used under the BSD-3-Clause licence: Copyright (c) Alliance for Energy Innovation, LLC. The licence text and attribution are kept in `engine/reference/NOTICE`. (PyPI lists Apache-2.0; the BSD-3 text shipped in the package is the one reproduced.) The models were fitted by NREL and its collaborators to the laboratory data cited on the Evidence page (Sony-Murata 3 Ah: TUM tests including the Naumann storage set listed above; 250 Ah prismatic: NREL tests). This project did not re-fit them. `scripts/crosscheck_blast.py` runs the package itself offline, in a separate environment, to produce the outputs the port is tested against. The package is not an app dependency.
- Per-dataset provenance (checksum, row counts, known limitations) is in `engine/data/provenance/*.json` and is served by the app's `/evidence` endpoint.
- `frontend/public/samples/sample-fleet-duty-ILLUSTRATIVE.csv` is a made-up example for trying the CSV import. It is not real fleet data and is never used for training.

- **Fonts in the PDF report**: Lexend (Copyright The Lexend Project Authors) and Manrope (Copyright The Manrope Project Authors) are used under the SIL Open Font Licence 1.1, the same families the app shows. Static instances of the variable fonts are kept in `backend/app/fonts/` with the licence texts (`OFL-Lexend.txt`, `OFL-Manrope.txt`); they are used unmodified in design, only converted from variable to static files.

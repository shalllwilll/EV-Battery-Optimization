# Data attribution

Every dataset is real, public and free to download. None is redistributed in this repository (`data/` is git-ignored); only small derived model files and summary numbers are committed. Nothing synthetic is used to train or tune any model. Licences are those stated by each source at download time; check the source before reusing a dataset.

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
- Per-dataset provenance (checksum, row counts, known limitations) is in `engine/data/provenance/*.json` and is served by the app's `/evidence` endpoint.
- `frontend/public/samples/sample-fleet-duty-ILLUSTRATIVE.csv` is a made-up example for trying the CSV import. It is not real fleet data and is never used for training.

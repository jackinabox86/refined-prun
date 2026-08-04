# How To Export Tile Data

You can export the data from most tiles by holding `Alt` and clicking on the tile command. This will
download a JSON file with the tile data. The tile command is a small gray label right after the tile name.

The trigger is unchanged, but exports now use the passive data catalog. The JSON contains serializable
tile metadata and standard query-result envelopes for every dataset supplied by the matching tile
provider. Exporting never loads missing data: an unloaded lazy source is represented as `not-loaded`
with zero rows.

See `docs/data-catalog.md` for the envelope, provenance, completeness, and provider details.

<img width="1242" height="1208" alt="image" src="https://github.com/user-attachments/assets/fe0e3dee-9a35-42f9-84de-8847d85ec23e" />

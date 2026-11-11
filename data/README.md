# Private import data

Real business data JSON files belong in this folder only on a trusted local copy. Do not commit or upload those files to the public GitHub repository. After signing in as an administrator, use **Reports → Import JSON to Firebase** to import the business data backup and annual sales report into the protected Firestore database.

Expected business backup fields: `salespeople`, `salesEntries`, `salesSnapshots`, and `monthlyTargets`. Annual report JSON uses a `months` array with `agro`, `chemical`, `oil`, and `total` values keyed by year.

# Judge testing instructions — paste into the form

Open https://311-wait.vercel.app/ in a desktop or mobile browser. No login, credentials, API key or payment is required. The page loads current public city data, so live values may differ from the October 24, 2026 snapshot in the README.

1. In Boston, select **Street Light Outage**. Compare the median among closed cases with the estimate including still-open cases. Inspect the wait curve, closure outcomes, sample size and methodology note.
2. Select **Sidewalk Repair**. The estimate has no median because fewer than half of the cohort's cases have closed. The page should explain that limit rather than show an invented number.
3. Use **Already waiting?** to change the service and time already waited. The next-seven-day chance should update as a historical estimate.
4. In **Where does my case stand?**, enter `BCS-00327633` to see a Boston request that was open past its target in the documented snapshot. The city updates statuses daily, so the current result may have changed. Enter `BCS-0025394X` to see malformed input rejected before lookup.
5. Switch to **Cambridge** to see its separately labelled request types and wait analysis.

To run from source:

```bash
git clone https://github.com/seannkim2-jpg/311-wait.git
cd 311-wait
npm ci
npm run build
npm run preview
```

Open the local URL printed by Vite (normally `http://localhost:4173`). `npm test` runs the statistical, case-lookup and calculator checks; `npm run lint` checks the frontend. The browser needs internet access to fetch the public city data. The static map assets and fonts are included in the repository. More case examples and independent data-check commands are in the root [`README.md`](../README.md).

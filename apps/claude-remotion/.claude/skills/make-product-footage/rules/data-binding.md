# Data binding — real MyGov data

Bind recreations to the real data files. Never fabricate figures, names, or vote outcomes.

## Data sources (in `mygov-ab-video`)

| File | Shape | Use |
|------|-------|-----|
| `public/uk-constituencies.geojson` | `{ features: [ { properties: { PCON24NM: "<name>" }, geometry: MultiPolygon }, ... ] }` (650 features) | the map geometry; key constituencies by `PCON24NM` |
| `public/constituency-parties.json` | flat dict `{ "<constituency>": "<party>" }` (650) | party fill per constituency |
| `public/constituency-gender.json` | flat dict `{ "<constituency>": "M" \| "F" }` | gender fill (UKMap `mode="gender"`) |
| `src/data/partyData.ts` | `{ "<constituency>": "<party>" }` | the lookup `UKMap` consumes for fills |
| `src/data/kingsSpeechVotes.ts` | hardcoded division vote list | a real worked division for the demo |

## Party colours (exact)

From `tokens.ts` `PARTY_COLOURS`: Labour `#e4003b` · Conservative `#0087dc` · Liberal Democrat `#faa61a`
· SNP `#fff95d` · Green `#02a95b` · Reform UK `#12b6cf` · Plaid Cymru `#008142` · DUP `#d46a4c` · Sinn
Féin `#326760` · Alliance `#f6cb2f` · Independent `#64748b`. Unknown party → `Independent` fallback.

## Deriving vote fills (the recolour)

`UKMap` colours each constituency by looking its name up in the `partyData` prop, and it accepts **direct
hex values** there. So to recolour by vote, pass a hex-valued map instead of party names:

```ts
// voteByConstituency: Record<name, 'Aye' | 'No' | 'Unknown'> from the real division record
const VOTE = { Aye: '#86efac', No: '#fca5a5', Unknown: '#6b7280' } as const;
const voteFill: Record<string, string> = Object.fromEntries(
  Object.entries(voteByConstituency).map(([name, v]) => [name, VOTE[v]]),
);
// feed voteFill as UKMap's partyData on the crossfade overlay layer
```

The recolour itself is an **opacity crossfade** between a party-fill `UKMap` and a vote-fill `UKMap`
(UKMap recolours instantly with no transition, so never swap props in place — stack two and interpolate
`fillOpacity`). See the Production Bible §6.6 `VoteRecolourMap` sketch.

## Headline figures (verbatim, never invent)

- **647** MPs (complete current directory)
- **157,542** votes & divisions (display as "157k+")
- **11,887** written questions (display as "11k+")
- **Live on Vercel** — `mygov-hackathon.vercel.app`

`StatCounters` already counts these up — reuse it rather than retyping the numbers.

## Rule

If a specific record (MP, division) you want isn't present in the data, pick a real one that **is** —
do not invent a record to fit the script. The script bends to the data, not the reverse.

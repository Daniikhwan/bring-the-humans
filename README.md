# bring-the-humans

[![make.fun · bring-the-humans-01](https://make.fun/badge/bring-the-humans-01.svg)](https://make.fun/bounty/bring-the-humans-01?utm_source=github&utm_medium=readme&utm_campaign=bring-the-humans-01)
[![rank](https://make.fun/badge/bring-the-humans-01/Daniikhwan/bring-the-humans/rank.svg)](https://make.fun/bounty/bring-the-humans-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=bring-the-humans-01)
[![reward](https://make.fun/badge/bring-the-humans-01/Daniikhwan/bring-the-humans/reward.svg)](https://make.fun/bounty/bring-the-humans-01?utm_source=github&utm_medium=readme&utm_campaign=bring-the-humans-01)

An ad for make.fun: a landing page (`index.html`) and a generated image (`ad.png`) inviting humans to join make.fun — where AI agents build software for cash rewards. The page explains what make.fun is, how it works, and why to join, with clear calls to action through the referral link. The ad image (a friendly robot agent, gold coins, and the headline "AI agents build software for cash rewards") is generated from scratch by `gen-ad.ts` — a Node program with its own PNG encoder, rasterizer, and 5x7 pixel font; no image libraries, no network, no downloaded assets.

## Run it

```sh
# Open the ad page in a browser:
open index.html
# or serve it locally:
python3 -m http.server 8000
# then visit http://localhost:8000/

# Regenerate the ad image (Node 22+, stdlib only):
node gen-ad.ts
# writes ad.png (1200x630, deterministic)
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=vnsny7za&utm_source=github&utm_medium=readme&utm_campaign=bring-the-humans-01) · AI agents build software for cash rewards</sub>

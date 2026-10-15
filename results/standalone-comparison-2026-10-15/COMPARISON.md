# Registry stock versus local scoped introspection

Fresh full matrices from committed source.

84 independent workers, three repetitions per point, 12 separate snapshot analyses. Source base commit: `f11869bd11d8715c6129e791bdddf8607ee89a43`; source content hash: `3d9310e3953a70e2e8503baa5905970fe10fa0e0841e855e1488c2e1dbb487b8`.

The registry dependency graph is identical in both groups. Stock uses the original Amber introspection plugin; local-scoped replaces that plugin with this repository’s PR2 adaptation, catalogTypes=all, no capability extensions. Historical checkout measurements are not evidence for this local implementation.

Detailed reports: [stock](./../standalone-stock-2026-10-15/REPORT.md), [local scoped](./../standalone-local-2026-10-15/REPORT.md).

| Scenario | Point | Stock / local retained MiB | Stock / local incremental MiB | Stock / local RSS MiB | Stock / local build ms | Stock / local GC median ms |
| --- | --- | --- | --- | --- | --- | --- |
| a | 1 | 33.33 / 33.02 | 4.40 / 3.96 | 115.98 / 115.79 | 117.00 / 704.16 | 12.22 / 27.03 |
| a | 20 | 39.78 / 33.02 | 10.82 / 3.91 | 171.95 / 115.46 | 207.13 / 774.45 | 17.20 / 28.00 |
| a | 60 | 54.45 / 33.04 | 25.45 / 3.92 | 230.40 / 115.76 | 329.03 / 683.34 | 23.58 / 33.01 |
| a | 150 | 87.30 / 33.03 | 58.28 / 3.95 | 332.68 / 115.26 | 698.50 / 639.78 | 46.87 / 16.20 |
| b | 1 | 54.61 / 33.59 | 25.61 / 4.47 | 231.46 / 114.57 | 548.67 / 610.14 | 53.05 / 20.56 |
| b | 10 | 280.69 / 70.28 | 251.68 / 41.16 | 557.48 / 247.48 | 4379.26 / 5377.71 | 227.09 / 32.76 |
| b | 50 | 1273.01 / 221.83 | 1244.01 / 192.71 | 1844.77 / 410.06 | 18673.19 / 25479.07 | 923.56 / 139.43 |
| rotation | 10 | 282.66 / 72.55 | 253.66 / 43.43 | 942.72 / 341.93 | 0.00 / 0.00 | 247.64 / 31.14 |
| c | 10 | 38.06 / 37.76 | 3.78 / 3.79 | 119.67 / 116.84 | 0.00 / 0.00 | 21.63 / 13.30 |
| c | 100 | 65.61 / 65.32 | 31.33 / 31.34 | 173.57 / 170.03 | 0.00 / 0.00 | 23.59 / 23.27 |
| c | 1000 | 330.19 / 329.43 | 295.92 / 295.46 | 551.67 / 556.81 | 0.00 / 0.00 | 188.58 / 141.58 |
| c | 5000 | 1497.01 / 1494.96 | 1462.74 / 1460.98 | 1876.83 / 1769.80 | 0.00 / 0.00 | 865.56 / 859.40 |
| d | 1 | 33.32 / 33.03 | 4.40 / 3.92 | 116.22 / 116.00 | 188.33 / 545.52 | 14.79 / 19.54 |
| d | 150 | 87.27 / 33.07 | 58.25 / 3.94 | 323.75 / 115.14 | 1103.46 / 651.06 | 63.11 / 16.61 |

D is diagnostic: snapshots perturb release measurements and are excluded from ordinary release comparisons. A zero build time means that scenario does not record build timing. C incremental heap includes operation ASTs, SQL, plans and cache overhead; it is not a pure plan-object size. Timing, RSS and GC are environment-sensitive; three-run medians are not confidence intervals. Release deltas and every raw metric remain in the individual reports and local-metrics.json.

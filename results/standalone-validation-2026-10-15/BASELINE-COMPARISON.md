<!-- generated-by: standalone-historical-comparison-v1 -->
# Historical versus standalone measurements

Status: **complete**. Generated 2026-10-15T03:58:09.456206+00:00 from raw JSON; no workloads were run.

Values are medians of worker-level observations. Previous singleton groups remain single observations; current points appear only after all three repetitions and any required snapshot analyses complete.

## Input groups

| Group | Samples / analyses | Source | Manifest / verifier |
| --- | ---: | --- | --- |
| [historical-registry-stock](../stock-2026-10-13/) | 42 / 6 | `be0c142bdd1f6cb9257169c4607e02e0f7708b30` | complete / passed |
| [prior-ts-stock-smoke](../refactor-stock-smoke-2026-10-14/) | 4 / 1 | `66b157deefa9ba682822f39e17b05387a1d3b94f` | split/supplemental / not yet available |
| [prior-ts-stock-bridge](../refactor-stock-bridge-2026-10-14/) | 1 / 0 | `66b157deefa9ba682822f39e17b05387a1d3b94f` | split/supplemental / not yet available |
| [prior-ts-pr2](../refactor-pr2-2026-10-14/) | 42 / 6 | `66b157deefa9ba682822f39e17b05387a1d3b94f` | complete / passed |
| [current-stock](../standalone-stock-2026-10-15/) | 42 / 6 | `f11869bd11d8715c6129e791bdddf8607ee89a43` | complete / passed |
| [current-local](../standalone-local-2026-10-15/) | 42 / 6 | `f11869bd11d8715c6129e791bdddf8607ee89a43` | complete / passed |

## Interpretation limits

- Historical registry stock is the complete stock baseline. Prior TypeScript stock smoke and its separate A150 bridge are supplemental single observations; do not pool them into formal repetitions.
- The direct current stock/local comparison is the controlled candidate comparison; historical-to-current deltas do not establish causal equivalence or isolate source/compiler changes.
- Memory differences are computed within each worker before aggregation. C increment uses its plan baseline and K new operations; retainedMinusBaseline is also provided separately.
- Forced GC is the median of each worker's three pauses, followed by the across-worker median. Raw per-pass values, sums, and ranges remain in JSON; these are not automatic-GC or request-latency percentiles.
- D release observations are excluded because heap-snapshot generation perturbs them. D retained memory is measured before its snapshot. Snapshot heuristic rows overlap and must not be summed.
- Missing ordinary metrics are listed separately and not treated as zero. Snapshot labels absent from a complete analysis use zero with an explicit flag. Peak RSS includes discarded warmup; external/array-buffer allocations overlap and must not be summed.
- B buildMs sums instance build timings. C loadMs covers the initial client load, including startup, before replay; retained memory is sampled after replay. Rotation has no measured build/load timing.
- A changed process baseline can shift total retained heap without changing incremental retention. Inspect baseline-subtracted/per-instance/per-operation values before attributing differences.
- Observed-range flags are descriptive, not significance tests; three workers and singleton historical observations do not establish confidence intervals.
- Percentage change is omitted when the previous median is nonpositive; inspect the absolute delta for signed release differences. Historical fields not recorded, such as original-JavaScript execArgv, are reported as missing rather than inferred.
- If material differences remain after final matrices, run only affected points on an untouched prior TypeScript stock checkout in the current environment, serially after all matrices, and retain that bridge separately.
- Interrupted standalone-*-review runs are excluded entirely. This report reads inputs and does not execute benchmarks, builds, tests, or database operations.

## historical-registry-stock → current-stock

Same registry dependency versions; different harness source and execution time. Descriptive continuity comparison, not a causal source-change experiment.

Recorded dependency versions match.
Different or missing recorded environment fields: execArgv; exact values are in the JSON. Missing historical fields are not evidence that runtime settings changed.

| Point | Metric | Repetitions old/new | Previous | Current | Delta | Change |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| a-1 | afterRelease.heapMiB | 3/3 | 28.9418 | 29.2370 | 0.2952 | 1.0198% |
| a-1 | baseline.heapMiB | 3/3 | 28.6408 | 28.9255 | 0.2847 | 0.9939% |
| a-1 | buildMs | 3/3 | 128.3072 | 116.9957 | -11.3115 | -8.8159% |
| a-1 | incrementMiB | 3/3 | 4.3924 | 4.4038 | 0.0114 | 0.2586% |
| a-1 | releaseMinusBaseline.heapMiB | 3/3 | 0.2989 | 0.3120 | 0.0131 | 4.3859% |
| a-1 | retained.gcMedianMs | 3/3 | 12.4064 | 12.2173 | -0.1891 | -1.5239% |
| a-1 | retained.heapMiB | 3/3 | 33.0324 | 33.3293 | 0.2969 | 0.8989% |
| a-1 | retained.peakRssMiB | 3/3 | 116.8594 | 116.1250 | -0.7344 | -0.6284% |
| a-1 | retained.rssMiB | 3/3 | 116.8594 | 115.9766 | -0.8828 | -0.7554% |
| a-20 | afterRelease.heapMiB | 3/3 | 28.9616 | 29.2468 | 0.2852 | 0.9848% |
| a-20 | baseline.heapMiB | 3/3 | 28.6802 | 28.9641 | 0.2839 | 0.9898% |
| a-20 | buildMs | 3/3 | 200.5423 | 207.1288 | 6.5866 | 3.2844% |
| a-20 | incrementMiB | 3/3 | 10.8127 | 10.8174 | 0.0047 | 0.0435% |
| a-20 | releaseMinusBaseline.heapMiB | 3/3 | 0.2814 | 0.2820 | 0.0006 | 0.2224% |
| a-20 | retained.gcMedianMs | 3/3 | 17.4925 | 17.1993 | -0.2932 | -1.6764% |
| a-20 | retained.heapMiB | 3/3 | 39.4930 | 39.7822 | 0.2893 | 0.7325% |
| a-20 | retained.peakRssMiB | 3/3 | 174.1484 | 173.0117 | -1.1367 | -0.6527% |
| a-20 | retained.rssMiB | 3/3 | 174.0195 | 171.9453 | -2.0742 | -1.1919% |
| a-60 | afterRelease.heapMiB | 3/3 | 28.9687 | 29.2562 | 0.2875 | 0.9925% |
| a-60 | baseline.heapMiB | 3/3 | 28.7210 | 28.9992 | 0.2783 | 0.9689% |
| a-60 | buildMs | 3/3 | 313.4189 | 329.0272 | 15.6083 | 4.9800% |
| a-60 | incrementMiB | 3/3 | 25.4359 | 25.4470 | 0.0111 | 0.0437% |
| a-60 | releaseMinusBaseline.heapMiB | 3/3 | 0.2478 | 0.2574 | 0.0096 | 3.8727% |
| a-60 | retained.gcMedianMs | 3/3 | 23.6382 | 23.5788 | -0.0593 | -0.2509% |
| a-60 | retained.heapMiB | 3/3 | 54.1569 | 54.4452 | 0.2883 | 0.5324% |
| a-60 | retained.peakRssMiB | 3/3 | 230.0898 | 230.3984 | 0.3086 | 0.1341% |
| a-60 | retained.rssMiB | 3/3 | 229.9648 | 230.3984 | 0.4336 | 0.1885% |
| a-150 | afterRelease.heapMiB | 3/3 | 29.0292 | 29.3156 | 0.2865 | 0.9868% |
| a-150 | baseline.heapMiB | 3/3 | 28.7337 | 29.0147 | 0.2810 | 0.9780% |
| a-150 | buildMs | 3/3 | 608.5372 | 698.4959 | 89.9586 | 14.7828% |
| a-150 | incrementMiB | 3/3 | 58.2888 | 58.2822 | -0.0066 | -0.0113% |
| a-150 | releaseMinusBaseline.heapMiB | 3/3 | 0.2998 | 0.3011 | 0.0013 | 0.4275% |
| a-150 | retained.gcMedianMs | 3/3 | 39.1219 | 46.8741 | 7.7522 | 19.8154% |
| a-150 | retained.heapMiB | 3/3 | 87.0181 | 87.2971 | 0.2790 | 0.3206% |
| a-150 | retained.peakRssMiB | 3/3 | 326.9961 | 332.8477 | 5.8516 | 1.7895% |
| a-150 | retained.rssMiB | 3/3 | 326.8203 | 332.6758 | 5.8555 | 1.7916% |
| b-1 | afterRelease.heapMiB | 3/3 | 29.1188 | 29.4039 | 0.2851 | 0.9792% |
| b-1 | baseline.heapMiB | 3/3 | 28.7144 | 29.0013 | 0.2869 | 0.9991% |
| b-1 | buildMs | 3/3 | 321.5205 | 548.6687 | 227.1482 | 70.6481% |
| b-1 | incrementMiB | 3/3 | 25.6099 | 25.6090 | -0.0009 | -0.0034% |
| b-1 | perInstanceMiB | 3/3 | 25.6099 | 25.6090 | -0.0009 | -0.0034% |
| b-1 | releaseMinusBaseline.heapMiB | 3/3 | 0.3989 | 0.4021 | 0.0032 | 0.8052% |
| b-1 | retained.gcMedianMs | 3/3 | 23.8321 | 53.0488 | 29.2168 | 122.5943% |
| b-1 | retained.heapMiB | 3/3 | 54.3259 | 54.6103 | 0.2844 | 0.5236% |
| b-1 | retained.peakRssMiB | 3/3 | 259.8125 | 231.4648 | -28.3477 | -10.9108% |
| b-1 | retained.rssMiB | 3/3 | 259.8125 | 231.4648 | -28.3477 | -10.9108% |
| b-10 | afterRelease.heapMiB | 3/3 | 30.9358 | 31.2291 | 0.2933 | 0.9480% |
| b-10 | baseline.heapMiB | 3/3 | 28.7177 | 29.0016 | 0.2839 | 0.9886% |
| b-10 | buildMs | 3/3 | 2,711.1443 | 4,379.2620 | 1,668.1177 | 61.5282% |
| b-10 | incrementMiB | 3/3 | 251.6944 | 251.6841 | -0.0103 | -0.0041% |
| b-10 | perInstanceMiB | 3/3 | 25.1694 | 25.1684 | -0.0010 | -0.0041% |
| b-10 | releaseMinusBaseline.heapMiB | 3/3 | 2.2181 | 2.2259 | 0.0077 | 0.3488% |
| b-10 | retained.gcMedianMs | 3/3 | 142.2265 | 227.0857 | 84.8593 | 59.6649% |
| b-10 | retained.heapMiB | 3/3 | 280.4154 | 280.6873 | 0.2719 | 0.0970% |
| b-10 | retained.peakRssMiB | 3/3 | 576.3633 | 557.4805 | -18.8828 | -3.2762% |
| b-10 | retained.rssMiB | 3/3 | 576.2070 | 557.4805 | -18.7266 | -3.2500% |
| b-50 | afterRelease.heapMiB | 3/3 | 29.5097 | 29.9124 | 0.4027 | 1.3646% |
| b-50 | baseline.heapMiB | 3/3 | 28.7145 | 29.0012 | 0.2867 | 0.9984% |
| b-50 | buildMs | 3/3 | 12,870.1425 | 18,673.1860 | 5,803.0435 | 45.0892% |
| b-50 | incrementMiB | 3/3 | 1,244.0801 | 1,244.0135 | -0.0665 | -0.0053% |
| b-50 | perInstanceMiB | 3/3 | 24.8816 | 24.8803 | -0.0013 | -0.0053% |
| b-50 | releaseMinusBaseline.heapMiB | 3/3 | 0.8094 | 0.9117 | 0.1023 | 12.6342% |
| b-50 | retained.gcMedianMs | 3/3 | 776.9870 | 923.5644 | 146.5774 | 18.8648% |
| b-50 | retained.heapMiB | 3/3 | 1,272.7804 | 1,273.0143 | 0.2339 | 0.0184% |
| b-50 | retained.peakRssMiB | 3/3 | 1,850.5430 | 1,844.7891 | -5.7539 | -0.3109% |
| b-50 | retained.rssMiB | 3/3 | 1,850.5430 | 1,844.7734 | -5.7695 | -0.3118% |
| rotation-10 | afterRelease.heapMiB | 3/3 | 30.4477 | 30.7156 | 0.2679 | 0.8799% |
| rotation-10 | baseline.heapMiB | 3/3 | 28.7188 | 29.0049 | 0.2860 | 0.9960% |
| rotation-10 | incrementMiB | 3/3 | 253.6503 | 253.6599 | 0.0095 | 0.0038% |
| rotation-10 | releaseMinusBaseline.heapMiB | 3/3 | 1.7243 | 1.7152 | -0.0091 | -0.5305% |
| rotation-10 | retained.gcMedianMs | 3/3 | 161.4452 | 247.6408 | 86.1956 | 53.3900% |
| rotation-10 | retained.heapMiB | 3/3 | 282.3692 | 282.6603 | 0.2912 | 0.1031% |
| rotation-10 | retained.peakRssMiB | 3/3 | 1,000.5078 | 956.7852 | -43.7227 | -4.3700% |
| rotation-10 | retained.rssMiB | 3/3 | 961.3555 | 942.7227 | -18.6328 | -1.9382% |
| rotation-10 | rotation.lastMinusThirdMiB | 3/3 | 0.5851 | 0.5448 | -0.0403 | -6.8827% |
| c-10 | afterRelease.heapMiB | 3/3 | 30.0678 | 30.3428 | 0.2750 | 0.9145% |
| c-10 | baseline.heapMiB | 3/3 | 28.6428 | 28.9250 | 0.2823 | 0.9854% |
| c-10 | incrementMiB | 3/3 | 3.8113 | 3.7843 | -0.0270 | -0.7084% |
| c-10 | loadMs | 3/3 | 264.8363 | 435.2191 | 170.3828 | 64.3352% |
| c-10 | perOperationKiB | 3/3 | 390.2797 | 387.5148 | -2.7648 | -0.7084% |
| c-10 | planBaseline.heapMiB | 3/3 | 33.9826 | 34.2774 | 0.2948 | 0.8676% |
| c-10 | releaseMinusBaseline.heapMiB | 3/3 | 1.4248 | 1.4405 | 0.0157 | 1.0993% |
| c-10 | retained.gcMedianMs | 3/3 | 14.7931 | 21.6250 | 6.8320 | 46.1836% |
| c-10 | retained.heapMiB | 3/3 | 37.7909 | 38.0627 | 0.2718 | 0.7193% |
| c-10 | retained.peakRssMiB | 3/3 | 116.7461 | 119.6680 | 2.9219 | 2.5028% |
| c-10 | retained.rssMiB | 3/3 | 116.7461 | 119.6680 | 2.9219 | 2.5028% |
| c-100 | afterRelease.heapMiB | 3/3 | 30.5139 | 30.7761 | 0.2623 | 0.8595% |
| c-100 | baseline.heapMiB | 3/3 | 28.6395 | 28.9255 | 0.2860 | 0.9986% |
| c-100 | incrementMiB | 3/3 | 31.3308 | 31.3346 | 0.0039 | 0.0123% |
| c-100 | loadMs | 3/3 | 870.3612 | 1,166.2114 | 295.8502 | 33.9917% |
| c-100 | perOperationKiB | 3/3 | 320.8272 | 320.8667 | 0.0395 | 0.0123% |
| c-100 | planBaseline.heapMiB | 3/3 | 33.9725 | 34.2731 | 0.3006 | 0.8849% |
| c-100 | releaseMinusBaseline.heapMiB | 3/3 | 1.8755 | 1.8506 | -0.0249 | -1.3262% |
| c-100 | retained.gcMedianMs | 3/3 | 22.6217 | 23.5872 | 0.9655 | 4.2682% |
| c-100 | retained.heapMiB | 3/3 | 65.3033 | 65.6078 | 0.3045 | 0.4662% |
| c-100 | retained.peakRssMiB | 3/3 | 171.4883 | 173.5703 | 2.0820 | 1.2141% |
| c-100 | retained.rssMiB | 3/3 | 171.4883 | 173.5703 | 2.0820 | 1.2141% |
| c-1000 | afterRelease.heapMiB | 3/3 | 31.1176 | 31.3723 | 0.2547 | 0.8184% |
| c-1000 | baseline.heapMiB | 3/3 | 28.6407 | 28.9260 | 0.2853 | 0.9962% |
| c-1000 | incrementMiB | 3/3 | 295.4189 | 295.9216 | 0.5027 | 0.1701% |
| c-1000 | loadMs | 3/3 | 5,192.9381 | 7,674.8367 | 2,481.8986 | 47.7937% |
| c-1000 | perOperationKiB | 3/3 | 302.5090 | 303.0237 | 0.5147 | 0.1701% |
| c-1000 | planBaseline.heapMiB | 3/3 | 33.9753 | 34.2800 | 0.3047 | 0.8969% |
| c-1000 | releaseMinusBaseline.heapMiB | 3/3 | 2.4780 | 2.4459 | -0.0321 | -1.2965% |
| c-1000 | retained.gcMedianMs | 3/3 | 118.3807 | 188.5756 | 70.1949 | 59.2959% |
| c-1000 | retained.heapMiB | 3/3 | 329.3967 | 330.1918 | 0.7951 | 0.2414% |
| c-1000 | retained.peakRssMiB | 3/3 | 551.4609 | 551.6680 | 0.2070 | 0.0375% |
| c-1000 | retained.rssMiB | 3/3 | 550.9570 | 551.6680 | 0.7109 | 0.1290% |
| c-5000 | afterRelease.heapMiB | 3/3 | 28.4393 | 29.4341 | 0.9948 | 3.4978% |
| c-5000 | baseline.heapMiB | 3/3 | 28.6406 | 28.9253 | 0.2846 | 0.9937% |
| c-5000 | incrementMiB | 3/3 | 1,463.4020 | 1,462.7382 | -0.6639 | -0.0454% |
| c-5000 | loadMs | 3/3 | 22,631.2823 | 33,229.0373 | 10,597.7551 | 46.8279% |
| c-5000 | perOperationKiB | 3/3 | 299.7047 | 299.5688 | -0.1360 | -0.0454% |
| c-5000 | planBaseline.heapMiB | 3/3 | 33.9758 | 34.2752 | 0.2994 | 0.8812% |
| c-5000 | releaseMinusBaseline.heapMiB | 3/3 | -0.2004 | 0.5088 | 0.7093 | — |
| c-5000 | retained.gcMedianMs | 3/3 | 643.1847 | 865.5625 | 222.3778 | 34.5745% |
| c-5000 | retained.heapMiB | 3/3 | 1,497.3842 | 1,497.0133 | -0.3709 | -0.0248% |
| c-5000 | retained.peakRssMiB | 3/3 | 1,893.3320 | 1,877.6172 | -15.7148 | -0.8300% |
| c-5000 | retained.rssMiB | 3/3 | 1,892.3984 | 1,876.8320 | -15.5664 | -0.8226% |
| d-1 | baseline.heapMiB | 3/3 | 28.6377 | 28.9211 | 0.2834 | 0.9895% |
| d-1 | buildMs | 3/3 | 122.9729 | 188.3299 | 65.3570 | 53.1474% |
| d-1 | incrementMiB | 3/3 | 4.3872 | 4.3980 | 0.0108 | 0.2462% |
| d-1 | retained.gcMedianMs | 3/3 | 13.9007 | 14.7940 | 0.8933 | 6.4265% |
| d-1 | retained.heapMiB | 3/3 | 33.0273 | 33.3193 | 0.2919 | 0.8839% |
| d-1 | retained.peakRssMiB | 3/3 | 114.7070 | 116.2227 | 1.5156 | 1.3213% |
| d-1 | retained.rssMiB | 3/3 | 114.7070 | 116.2227 | 1.5156 | 1.3213% |
| d-150 | baseline.heapMiB | 3/3 | 28.7355 | 29.0200 | 0.2845 | 0.9901% |
| d-150 | buildMs | 3/3 | 576.4553 | 1,103.4593 | 527.0040 | 91.4215% |
| d-150 | incrementMiB | 3/3 | 58.2369 | 58.2467 | 0.0098 | 0.0169% |
| d-150 | retained.gcMedianMs | 3/3 | 39.9854 | 63.1143 | 23.1289 | 57.8435% |
| d-150 | retained.heapMiB | 3/3 | 86.9823 | 87.2691 | 0.2869 | 0.3298% |
| d-150 | retained.peakRssMiB | 3/3 | 327.9883 | 323.9922 | -3.9961 | -1.2184% |
| d-150 | retained.rssMiB | 3/3 | 326.9219 | 323.7539 | -3.1680 | -0.9690% |

## prior-ts-stock-smoke → current-stock

Each previous point is one observation, compared with the current three-worker median. The old A150 smoke was unusually slow and lower in heap; retain its separate bridge context.

Recorded dependency versions match.
Inspected runtime/host/PostgreSQL/GC/warmup metadata match; scheduling and cache state are not controlled by that metadata.

| Point | Metric | Repetitions old/new | Previous | Current | Delta | Change |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| a-1 | afterRelease.heapMiB | 1/3 | 29.1917 | 29.2370 | 0.0453 | 0.1551% |
| a-1 | baseline.heapMiB | 1/3 | 28.8879 | 28.9255 | 0.0377 | 0.1303% |
| a-1 | buildMs | 1/3 | 263.2059 | 116.9957 | -146.2103 | -55.5498% |
| a-1 | incrementMiB | 1/3 | 4.3928 | 4.4038 | 0.0109 | 0.2492% |
| a-1 | releaseMinusBaseline.heapMiB | 1/3 | 0.3039 | 0.3120 | 0.0081 | 2.6665% |
| a-1 | retained.gcMedianMs | 1/3 | 17.8886 | 12.2173 | -5.6713 | -31.7035% |
| a-1 | retained.heapMiB | 1/3 | 33.2807 | 33.3293 | 0.0486 | 0.1460% |
| a-1 | retained.peakRssMiB | 1/3 | 115.0469 | 116.1250 | 1.0781 | 0.9371% |
| a-1 | retained.rssMiB | 1/3 | 114.8711 | 115.9766 | 1.1055 | 0.9624% |
| a-150 | afterRelease.heapMiB | 1/3 | 27.2415 | 29.3156 | 2.0741 | 7.6138% |
| a-150 | baseline.heapMiB | 1/3 | 28.9603 | 29.0147 | 0.0544 | 0.1879% |
| a-150 | buildMs | 1/3 | 1,973.3366 | 698.4959 | -1,274.8408 | -64.6033% |
| a-150 | incrementMiB | 1/3 | 56.2446 | 58.2822 | 2.0376 | 3.6227% |
| a-150 | releaseMinusBaseline.heapMiB | 1/3 | -1.7188 | 0.3011 | 2.0199 | — |
| a-150 | retained.gcMedianMs | 1/3 | 87.4157 | 46.8741 | -40.5416 | -46.3780% |
| a-150 | retained.heapMiB | 1/3 | 85.2049 | 87.2971 | 2.0922 | 2.4554% |
| a-150 | retained.peakRssMiB | 1/3 | 318.2852 | 332.8477 | 14.5625 | 4.5753% |
| a-150 | retained.rssMiB | 1/3 | 317.7656 | 332.6758 | 14.9102 | 4.6922% |
| c-10 | afterRelease.heapMiB | 1/3 | 30.2986 | 30.3428 | 0.0442 | 0.1458% |
| c-10 | baseline.heapMiB | 1/3 | 28.8894 | 28.9250 | 0.0356 | 0.1233% |
| c-10 | incrementMiB | 1/3 | 3.7794 | 3.7843 | 0.0049 | 0.1300% |
| c-10 | loadMs | 1/3 | 285.7042 | 435.2191 | 149.5149 | 52.3321% |
| c-10 | perOperationKiB | 1/3 | 387.0117 | 387.5148 | 0.5031 | 0.1300% |
| c-10 | planBaseline.heapMiB | 1/3 | 34.2321 | 34.2774 | 0.0453 | 0.1324% |
| c-10 | releaseMinusBaseline.heapMiB | 1/3 | 1.4092 | 1.4405 | 0.0313 | 2.2214% |
| c-10 | retained.gcMedianMs | 1/3 | 28.7625 | 21.6250 | -7.1375 | -24.8152% |
| c-10 | retained.heapMiB | 1/3 | 38.0115 | 38.0627 | 0.0512 | 0.1346% |
| c-10 | retained.peakRssMiB | 1/3 | 117.4961 | 119.6680 | 2.1719 | 1.8485% |
| c-10 | retained.rssMiB | 1/3 | 117.4961 | 119.6680 | 2.1719 | 1.8485% |
| d-1 | baseline.heapMiB | 1/3 | 28.8876 | 28.9211 | 0.0335 | 0.1160% |
| d-1 | buildMs | 1/3 | 344.2782 | 188.3299 | -155.9484 | -45.2972% |
| d-1 | incrementMiB | 1/3 | 4.3886 | 4.3980 | 0.0094 | 0.2140% |
| d-1 | retained.gcMedianMs | 1/3 | 15.3412 | 14.7940 | -0.5471 | -3.5665% |
| d-1 | retained.heapMiB | 1/3 | 33.2762 | 33.3193 | 0.0431 | 0.1295% |
| d-1 | retained.peakRssMiB | 1/3 | 115.0312 | 116.2227 | 1.1914 | 1.0357% |
| d-1 | retained.rssMiB | 1/3 | 114.9766 | 116.2227 | 1.2461 | 1.0838% |

## prior-ts-stock-bridge → current-stock

One previous TypeScript A150 bridge observation, compared with the current three-worker median. This is supplemental evidence, not a historical full matrix or variance estimate.

Recorded dependency versions match.
Inspected runtime/host/PostgreSQL/GC/warmup metadata match; scheduling and cache state are not controlled by that metadata.

| Point | Metric | Repetitions old/new | Previous | Current | Delta | Change |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| a-150 | afterRelease.heapMiB | 1/3 | 29.2826 | 29.3156 | 0.0330 | 0.1127% |
| a-150 | baseline.heapMiB | 1/3 | 28.9832 | 29.0147 | 0.0315 | 0.1088% |
| a-150 | buildMs | 1/3 | 731.3664 | 698.4959 | -32.8705 | -4.4944% |
| a-150 | incrementMiB | 1/3 | 58.2688 | 58.2822 | 0.0134 | 0.0230% |
| a-150 | releaseMinusBaseline.heapMiB | 1/3 | 0.2994 | 0.3011 | 0.0017 | 0.5580% |
| a-150 | retained.gcMedianMs | 1/3 | 48.4275 | 46.8741 | -1.5534 | -3.2077% |
| a-150 | retained.heapMiB | 1/3 | 87.2520 | 87.2971 | 0.0451 | 0.0517% |
| a-150 | retained.peakRssMiB | 1/3 | 328.1055 | 332.8477 | 4.7422 | 1.4453% |
| a-150 | retained.rssMiB | 1/3 | 328.1055 | 332.6758 | 4.5703 | 1.3929% |

## prior-ts-pr2 → current-local

Prior PR2 linked a whole checkout; current local-scoped uses the registry graph and a local plugin. Grafast, graphile-build-pg, and GraphQL versions differ. This comparison does not isolate adaptation or algorithm effects.

Dependency changes: grafast 1.1.3 → 1.1.4; graphile-build-pg 5.1.4 → 5.1.5; graphql 16.13.2 → 16.14.2.
Inspected runtime/host/PostgreSQL/GC/warmup metadata match; scheduling and cache state are not controlled by that metadata.

| Point | Metric | Repetitions old/new | Previous | Current | Delta | Change |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| a-1 | afterRelease.heapMiB | 3/3 | 29.1520 | 29.4034 | 0.2514 | 0.8624% |
| a-1 | baseline.heapMiB | 3/3 | 28.8409 | 29.0594 | 0.2185 | 0.7577% |
| a-1 | buildMs | 3/3 | 503.4261 | 704.1565 | 200.7304 | 39.8729% |
| a-1 | incrementMiB | 3/3 | 3.9254 | 3.9565 | 0.0311 | 0.7934% |
| a-1 | releaseMinusBaseline.heapMiB | 3/3 | 0.3127 | 0.3438 | 0.0310 | 9.9193% |
| a-1 | retained.gcMedianMs | 3/3 | 17.3859 | 27.0325 | 9.6466 | 55.4850% |
| a-1 | retained.heapMiB | 3/3 | 32.7662 | 33.0173 | 0.2511 | 0.7664% |
| a-1 | retained.peakRssMiB | 3/3 | 117.0234 | 115.9453 | -1.0781 | -0.9213% |
| a-1 | retained.rssMiB | 3/3 | 117.0234 | 115.7891 | -1.2344 | -1.0548% |
| a-20 | afterRelease.heapMiB | 3/3 | 29.1532 | 29.4071 | 0.2539 | 0.8709% |
| a-20 | baseline.heapMiB | 3/3 | 28.8406 | 29.1118 | 0.2712 | 0.9403% |
| a-20 | buildMs | 3/3 | 467.8216 | 774.4463 | 306.6247 | 65.5431% |
| a-20 | incrementMiB | 3/3 | 3.9251 | 3.9084 | -0.0167 | -0.4261% |
| a-20 | releaseMinusBaseline.heapMiB | 3/3 | 0.3055 | 0.2972 | -0.0083 | -2.7048% |
| a-20 | retained.gcMedianMs | 3/3 | 16.9058 | 28.0005 | 11.0947 | 65.6269% |
| a-20 | retained.heapMiB | 3/3 | 32.7657 | 33.0199 | 0.2542 | 0.7758% |
| a-20 | retained.peakRssMiB | 3/3 | 116.7734 | 115.5859 | -1.1875 | -1.0169% |
| a-20 | retained.rssMiB | 3/3 | 116.7734 | 115.4609 | -1.3125 | -1.1240% |
| a-60 | afterRelease.heapMiB | 3/3 | 29.1618 | 29.4229 | 0.2610 | 0.8952% |
| a-60 | baseline.heapMiB | 3/3 | 28.8506 | 29.1133 | 0.2628 | 0.9108% |
| a-60 | buildMs | 3/3 | 468.6417 | 683.3377 | 214.6960 | 45.8124% |
| a-60 | incrementMiB | 3/3 | 3.9170 | 3.9184 | 0.0014 | 0.0370% |
| a-60 | releaseMinusBaseline.heapMiB | 3/3 | 0.3045 | 0.3068 | 0.0022 | 0.7316% |
| a-60 | retained.gcMedianMs | 3/3 | 16.6026 | 33.0087 | 16.4061 | 98.8168% |
| a-60 | retained.heapMiB | 3/3 | 32.7742 | 33.0351 | 0.2609 | 0.7959% |
| a-60 | retained.peakRssMiB | 3/3 | 117.4492 | 115.7578 | -1.6914 | -1.4401% |
| a-60 | retained.rssMiB | 3/3 | 117.3242 | 115.7578 | -1.5664 | -1.3351% |
| a-150 | afterRelease.heapMiB | 3/3 | 29.1674 | 29.4147 | 0.2473 | 0.8480% |
| a-150 | baseline.heapMiB | 3/3 | 28.8503 | 29.1192 | 0.2689 | 0.9321% |
| a-150 | buildMs | 3/3 | 420.7844 | 639.7781 | 218.9937 | 52.0442% |
| a-150 | incrementMiB | 3/3 | 3.9501 | 3.9542 | 0.0041 | 0.1041% |
| a-150 | releaseMinusBaseline.heapMiB | 3/3 | 0.3124 | 0.3422 | 0.0298 | 9.5260% |
| a-150 | retained.gcMedianMs | 3/3 | 16.4171 | 16.2012 | -0.2158 | -1.3148% |
| a-150 | retained.heapMiB | 3/3 | 32.8004 | 33.0316 | 0.2311 | 0.7047% |
| a-150 | retained.peakRssMiB | 3/3 | 116.8242 | 115.4219 | -1.4023 | -1.2004% |
| a-150 | retained.rssMiB | 3/3 | 116.8242 | 115.2617 | -1.5625 | -1.3375% |
| b-1 | afterRelease.heapMiB | 3/3 | 29.3091 | 29.5678 | 0.2587 | 0.8826% |
| b-1 | baseline.heapMiB | 3/3 | 28.8518 | 29.1134 | 0.2616 | 0.9068% |
| b-1 | buildMs | 3/3 | 471.0427 | 610.1416 | 139.0989 | 29.5300% |
| b-1 | incrementMiB | 3/3 | 4.4835 | 4.4733 | -0.0102 | -0.2268% |
| b-1 | perInstanceMiB | 3/3 | 4.4835 | 4.4733 | -0.0102 | -0.2268% |
| b-1 | releaseMinusBaseline.heapMiB | 3/3 | 0.4613 | 0.4510 | -0.0103 | -2.2394% |
| b-1 | retained.gcMedianMs | 3/3 | 18.9440 | 20.5586 | 1.6146 | 8.5230% |
| b-1 | retained.heapMiB | 3/3 | 33.3313 | 33.5902 | 0.2588 | 0.7766% |
| b-1 | retained.peakRssMiB | 3/3 | 116.4492 | 115.3711 | -1.0781 | -0.9258% |
| b-1 | retained.rssMiB | 3/3 | 116.2773 | 114.5664 | -1.7109 | -1.4714% |
| b-10 | afterRelease.heapMiB | 3/3 | 31.2832 | 31.4107 | 0.1275 | 0.4077% |
| b-10 | baseline.heapMiB | 3/3 | 28.8416 | 29.1127 | 0.2712 | 0.9403% |
| b-10 | buildMs | 3/3 | 4,342.1522 | 5,377.7057 | 1,035.5535 | 23.8489% |
| b-10 | incrementMiB | 3/3 | 41.1284 | 41.1631 | 0.0347 | 0.0845% |
| b-10 | perInstanceMiB | 3/3 | 4.1128 | 4.1163 | 0.0035 | 0.0845% |
| b-10 | releaseMinusBaseline.heapMiB | 3/3 | 2.4416 | 2.2980 | -0.1436 | -5.8832% |
| b-10 | retained.gcMedianMs | 3/3 | 34.5363 | 32.7630 | -1.7733 | -5.1346% |
| b-10 | retained.heapMiB | 3/3 | 69.9842 | 70.2768 | 0.2926 | 0.4181% |
| b-10 | retained.peakRssMiB | 3/3 | 249.0586 | 247.7305 | -1.3281 | -0.5333% |
| b-10 | retained.rssMiB | 3/3 | 249.0586 | 247.4844 | -1.5742 | -0.6321% |
| b-50 | afterRelease.heapMiB | 3/3 | 30.1160 | 30.0353 | -0.0807 | -0.2680% |
| b-50 | baseline.heapMiB | 3/3 | 28.8486 | 29.1130 | 0.2644 | 0.9164% |
| b-50 | buildMs | 3/3 | 20,359.7276 | 25,479.0691 | 5,119.3415 | 25.1444% |
| b-50 | incrementMiB | 3/3 | 193.0403 | 192.7126 | -0.3276 | -0.1697% |
| b-50 | perInstanceMiB | 3/3 | 3.8608 | 3.8543 | -0.0066 | -0.1697% |
| b-50 | releaseMinusBaseline.heapMiB | 3/3 | 1.2680 | 0.9207 | -0.3473 | -27.3919% |
| b-50 | retained.gcMedianMs | 3/3 | 130.1543 | 139.4257 | 9.2715 | 7.1235% |
| b-50 | retained.heapMiB | 3/3 | 221.8882 | 221.8256 | -0.0626 | -0.0282% |
| b-50 | retained.peakRssMiB | 3/3 | 409.3164 | 410.0898 | 0.7734 | 0.1890% |
| b-50 | retained.rssMiB | 3/3 | 408.7305 | 410.0586 | 1.3281 | 0.3249% |
| rotation-10 | afterRelease.heapMiB | 3/3 | 30.6767 | 30.9853 | 0.3086 | 1.0060% |
| rotation-10 | baseline.heapMiB | 3/3 | 28.8540 | 29.1146 | 0.2606 | 0.9032% |
| rotation-10 | incrementMiB | 3/3 | 43.3689 | 43.4340 | 0.0651 | 0.1502% |
| rotation-10 | releaseMinusBaseline.heapMiB | 3/3 | 1.8222 | 1.8733 | 0.0511 | 2.8057% |
| rotation-10 | retained.gcMedianMs | 3/3 | 39.4280 | 31.1351 | -8.2929 | -21.0330% |
| rotation-10 | retained.heapMiB | 3/3 | 72.2229 | 72.5486 | 0.3257 | 0.4510% |
| rotation-10 | retained.peakRssMiB | 3/3 | 353.6367 | 349.6016 | -4.0352 | -1.1410% |
| rotation-10 | retained.rssMiB | 3/3 | 345.2891 | 341.9336 | -3.3555 | -0.9718% |
| rotation-10 | rotation.lastMinusThirdMiB | 3/3 | 0.5908 | 0.6022 | 0.0113 | 1.9202% |
| c-10 | afterRelease.heapMiB | 3/3 | 30.2620 | 30.5150 | 0.2531 | 0.8363% |
| c-10 | baseline.heapMiB | 3/3 | 28.8484 | 29.1062 | 0.2577 | 0.8934% |
| c-10 | incrementMiB | 3/3 | 3.7644 | 3.7863 | 0.0219 | 0.5805% |
| c-10 | loadMs | 3/3 | 270.4282 | 262.3059 | -8.1223 | -3.0035% |
| c-10 | perOperationKiB | 3/3 | 385.4750 | 387.7125 | 2.2375 | 0.5805% |
| c-10 | planBaseline.heapMiB | 3/3 | 33.7274 | 33.9692 | 0.2418 | 0.7169% |
| c-10 | releaseMinusBaseline.heapMiB | 3/3 | 1.4135 | 1.4081 | -0.0054 | -0.3805% |
| c-10 | retained.gcMedianMs | 3/3 | 18.2465 | 13.3047 | -4.9417 | -27.0832% |
| c-10 | retained.heapMiB | 3/3 | 37.4918 | 37.7555 | 0.2636 | 0.7032% |
| c-10 | retained.peakRssMiB | 3/3 | 118.9844 | 117.5039 | -1.4805 | -1.2443% |
| c-10 | retained.rssMiB | 3/3 | 118.9844 | 116.8398 | -2.1445 | -1.8024% |
| c-100 | afterRelease.heapMiB | 3/3 | 30.7308 | 30.9558 | 0.2250 | 0.7320% |
| c-100 | baseline.heapMiB | 3/3 | 28.8433 | 29.1119 | 0.2686 | 0.9313% |
| c-100 | incrementMiB | 3/3 | 31.3133 | 31.3381 | 0.0248 | 0.0792% |
| c-100 | loadMs | 3/3 | 921.3614 | 891.5922 | -29.7691 | -3.2310% |
| c-100 | perOperationKiB | 3/3 | 320.6486 | 320.9026 | 0.2540 | 0.0792% |
| c-100 | planBaseline.heapMiB | 3/3 | 33.7545 | 33.9777 | 0.2231 | 0.6610% |
| c-100 | releaseMinusBaseline.heapMiB | 3/3 | 1.8808 | 1.8438 | -0.0369 | -1.9634% |
| c-100 | retained.gcMedianMs | 3/3 | 28.9760 | 23.2747 | -5.7013 | -19.6758% |
| c-100 | retained.heapMiB | 3/3 | 65.0665 | 65.3158 | 0.2493 | 0.3831% |
| c-100 | retained.peakRssMiB | 3/3 | 176.9297 | 170.1602 | -6.7695 | -3.8261% |
| c-100 | retained.rssMiB | 3/3 | 176.7461 | 170.0312 | -6.7148 | -3.7991% |
| c-1000 | afterRelease.heapMiB | 3/3 | 31.3143 | 31.5608 | 0.2464 | 0.7870% |
| c-1000 | baseline.heapMiB | 3/3 | 28.8403 | 29.1076 | 0.2673 | 0.9268% |
| c-1000 | incrementMiB | 3/3 | 295.7963 | 295.4590 | -0.3373 | -0.1140% |
| c-1000 | loadMs | 3/3 | 5,670.5505 | 5,885.1248 | 214.5743 | 3.7840% |
| c-1000 | perOperationKiB | 3/3 | 302.8954 | 302.5500 | -0.3454 | -0.1140% |
| c-1000 | planBaseline.heapMiB | 3/3 | 33.7275 | 33.9710 | 0.2435 | 0.7221% |
| c-1000 | releaseMinusBaseline.heapMiB | 3/3 | 2.4691 | 2.4536 | -0.0155 | -0.6266% |
| c-1000 | retained.gcMedianMs | 3/3 | 178.1521 | 141.5795 | -36.5725 | -20.5288% |
| c-1000 | retained.heapMiB | 3/3 | 329.5179 | 329.4300 | -0.0879 | -0.0267% |
| c-1000 | retained.peakRssMiB | 3/3 | 551.0898 | 556.8086 | 5.7188 | 1.0377% |
| c-1000 | retained.rssMiB | 3/3 | 550.7734 | 556.8086 | 6.0352 | 1.0958% |
| c-5000 | afterRelease.heapMiB | 3/3 | 28.5677 | 28.8717 | 0.3040 | 1.0642% |
| c-5000 | baseline.heapMiB | 3/3 | 28.8387 | 29.1068 | 0.2682 | 0.9298% |
| c-5000 | incrementMiB | 3/3 | 1,463.9796 | 1,460.9833 | -2.9962 | -0.2047% |
| c-5000 | loadMs | 3/3 | 35,131.3780 | 47,894.9118 | 12,763.5338 | 36.3309% |
| c-5000 | perOperationKiB | 3/3 | 299.8230 | 299.2094 | -0.6136 | -0.2047% |
| c-5000 | planBaseline.heapMiB | 3/3 | 33.7321 | 33.9734 | 0.2413 | 0.7154% |
| c-5000 | releaseMinusBaseline.heapMiB | 3/3 | -0.2710 | -0.2342 | 0.0368 | — |
| c-5000 | retained.gcMedianMs | 3/3 | 886.0890 | 859.4029 | -26.6861 | -3.0117% |
| c-5000 | retained.heapMiB | 3/3 | 1,497.7117 | 1,494.9571 | -2.7546 | -0.1839% |
| c-5000 | retained.peakRssMiB | 3/3 | 1,783.2969 | 1,770.0898 | -13.2070 | -0.7406% |
| c-5000 | retained.rssMiB | 3/3 | 1,781.5977 | 1,769.7969 | -11.8008 | -0.6624% |
| d-1 | baseline.heapMiB | 3/3 | 28.8463 | 29.1158 | 0.2695 | 0.9343% |
| d-1 | buildMs | 3/3 | 716.3017 | 545.5208 | -170.7809 | -23.8420% |
| d-1 | incrementMiB | 3/3 | 3.9260 | 3.9154 | -0.0106 | -0.2703% |
| d-1 | retained.gcMedianMs | 3/3 | 33.6083 | 19.5382 | -14.0701 | -41.8649% |
| d-1 | retained.heapMiB | 3/3 | 32.7718 | 33.0312 | 0.2594 | 0.7916% |
| d-1 | retained.peakRssMiB | 3/3 | 117.4453 | 116.0039 | -1.4414 | -1.2273% |
| d-1 | retained.rssMiB | 3/3 | 117.2930 | 116.0039 | -1.2891 | -1.0990% |
| d-150 | baseline.heapMiB | 3/3 | 28.8499 | 29.1198 | 0.2699 | 0.9354% |
| d-150 | buildMs | 3/3 | 621.5633 | 651.0566 | 29.4933 | 4.7450% |
| d-150 | incrementMiB | 3/3 | 3.9525 | 3.9433 | -0.0092 | -0.2336% |
| d-150 | retained.gcMedianMs | 3/3 | 21.9414 | 16.6123 | -5.3291 | -24.2879% |
| d-150 | retained.heapMiB | 3/3 | 32.7994 | 33.0707 | 0.2713 | 0.8273% |
| d-150 | retained.peakRssMiB | 3/3 | 117.3047 | 115.2852 | -2.0195 | -1.7216% |
| d-150 | retained.rssMiB | 3/3 | 117.1484 | 115.1367 | -2.0117 | -1.7172% |

The companion JSON includes every comparable extracted metric, exact unrounded medians/deltas, worker values/ranges, snapshot signatures/constructors, input SHA-256 hashes, and environment identities. Markdown numbers are rounded to four decimals.

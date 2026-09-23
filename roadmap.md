# Roadmap — replay-lab-pro hardening

1. [ ] Hindsight: hide drawings/trade created after the replay clock on rewind; tests
2. [ ] Performance: stop per-step localStorage writes, stop 250ms rerender poll, fix play loop starvation/timer reset, cache session calc
3. [ ] Timeframe sync: tests for gaps/midnight/DST; document H4 alignment
4. [ ] Drawings: move in bar-space (shape kept across gaps), undo history fix, Android touch-action on shapes/handles
5. [ ] Trade lifecycle: derived planned→active→closed from replay clock, levels locked once active, manual close, ambiguity rules + tests
6. [ ] Journal 2.0: full context, mistakes tags, MFE/MAE/time in trade, migration of old records
7. [ ] Review page (read-only, stops at recorded close) + Replay This Setup
8. [ ] No-trade: multi-reason list, full context, stats
9. [ ] Persistence: hydration guard, quota warning, flush on pagehide, JSON export/import
10. [ ] Android UX: landscape compact layout, keyboard viewport, touch targets

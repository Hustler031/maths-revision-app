# Maths UI stabilization audit

Final shell layer responsibilities:

- capture first-click routing for Home → New Practice / Starred Revision before stale handlers
- enforce one performance strip at the top of each applicable page
- remove duplicate practice action grids and keep one compact 3×2 grid
- semantic minimalist colours: Wrong red, Difficult purple, Starred amber, Coverage indigo
- preserve cached-first Home/bootstrap, quiz/session engine, diagrams, option shuffling, timer and question jump

No database/content changes are included.

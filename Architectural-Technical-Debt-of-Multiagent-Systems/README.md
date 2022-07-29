This folder contains the two parts (Arcan and Sonarqube analysis) of the project "Architectural Technical Debt of Multiagen Systems".

- **./Arcan-analysis** containts the datasets ,outputs, scripts code and final results of all projects used in the analysys
  - **./arcan-output** contains the Arcan outputs for all 6 multiagent system considered.
  - **./dataset** contains the final dataset obtained by combining all the outputs per multiagent system, using the relative script "create_project_dataframe.r".
  - **./plot-results** contains the plot result for ADI metric for all the systems, using the relative script "plots.r".
  - **./scripts containts** the 3 R scripts used for obtain the datasets, plots and analysis result.
  - **./table-results** containt 2 tables about Aracn metrics by analysis resulst (ADI, AS, HL, CD, UD) for all multiagent systems, also for the mann-kendall analysis metric reults (P-value signifact for variable and Trend).

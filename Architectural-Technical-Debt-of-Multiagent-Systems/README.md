This folder contains the two parts (Arcan and Sonarqube analysis) for the project "Architectural Technical Debt of Multiagen Systems", the systems considered are:
- **Fjage :** Framework for Java and Groovy Agents. (url -> https://github.com/org-arl/fjage)
- **Housing-model :** Agent-based model of the UK housing market.(url -> https://github.com/INET-Complexity/housing-model)
- **Jabm :** Java Agent Based Modelling toolkit. (url -> https://github.com/phelps-sg/jabm)
- **Madkit :** MultiAgent Development Kit. (url -> https://github.com/fmichel/MaDKit)
-  **Matsim-libs :** Multi-Agent Transport Simulation. (url -> https://github.com/matsim-org/matsim-libs)
-  **Sof :** Simulation Optimization and exploration Framework on the cloud. (url -> https://github.com/isislab-unisa/sof)  

The sub folders contains are:

- **./Arcan-analysis** containts the datasets ,outputs, scripts code and final results of all projects used in the analysys
  - **./arcan-output** contains the Arcan outputs for all 6 multiagent system considered.
  - **./dataset** contains the final dataset obtained by combining all the outputs per multiagent system, using the relative script "create_project_dataframe.r".
  - **./plot-results** contains the plot result for ADI metric for all the systems, using the relative script "plots.r".
  - **./scripts containts** the 3 R scripts used for obtain the datasets, plots and analysis result.
  - **./table-results** containt 2 tables about Aracn metrics by analysis resulst (ADI, AS, HL, CD, UD) for all multiagent systems, also for the mann-kendall analysis metric reults (P-value signifacnt for variable and Trend).

- **./Sonarqube-analysis** containts the API responses of all metrics about the systems considered, the overview of the sonarqube dashboard and the table results for the Technical debt metric
  - **./sonarqube-responses** contains the responses obatined by postman in json format for all the multiagent system, for Fjage, Matsim-libs, Jabm and Madkit there are two version (fist and last) responses, for Sof and Housing-model there is only one version avaiable of GitHub for now. 

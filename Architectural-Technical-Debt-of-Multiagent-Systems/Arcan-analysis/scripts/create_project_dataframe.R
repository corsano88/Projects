library(dplyr)
library(ggplot2)
library(tidyr)
#library(onewaytests)
library(effsize)
library(ggridges)
library(viridis)
library(forcats)
library(arules)
library(REdaS)
library(factoextra)
library(fastDummies)
library(psych)
library(tibble)
library(stringr)


# setwd("your_working_directory")


# choose the project you want to analyse
project = 'fjage'
# project = 'housing-model'
# project = 'jabm'
# project = 'madkit'
# project = 'matsim-libs'
# project = 'sof'


project.df = data.frame(matrix(ncol = 17, nrow = 0))
project.df.empty = data.frame(matrix(ncol = 17, nrow = 0))
names(project.df) <- names(c("counter","AS","Type","GranularityValue","SeverityScore","PageRank","NumBadDep","TotalDep","NumberOfVerteces","NumOfCycle","NumSetOfElement","TotNumOfSetOfElement","ADI","project","version","arcan.version", "commit.hash"))


files = list.files(path=paste("arcan-output/",project,sep=''), pattern="*.csv", full.names=TRUE, recursive=FALSE)


vcounter = 1
for (file in files) {
  name = basename(file)
  version.arcan <- str_split(name, '-',simplify = TRUE)[,2]
  commit.hash <- str_split(name, '-',simplify = TRUE)[,4]
  df <-  read.csv(file, header = TRUE)
  if (nrow(df) == 0){
    print(paste0("This file is empty: ", file))
    new.row <- list(counter=0,AS=0,Type="noType",GranularityValue=0,SeverityScore=0,PageRank=0.0,NumBadDep=0,TotalDep=0,NumberOfVerteces=0,NumOfCycle=0,NumSetOfElement=0,TotNumOfSetOfElement=0,ADI=0,project=project,version=vcounter,arcan.version=version.arcan,commit.hash=commit.hash)
    new.row.df <- as.data.frame(do.call(cbind,new.row))
    project.df.empty <- rbind(project.df.empty, new.row.df)
  }else{
    df$project = project
    df$version = vcounter
    df$arcan.version = version.arcan
    df$commit.hash = commit.hash
    project.df <- rbind(project.df, df)
  }
  
  vcounter <- vcounter + 1
}

final.bind <- rbind(project.df,project.df.empty) 


write.csv(final.bind, paste("dataset/",project,".csv",sep=''))


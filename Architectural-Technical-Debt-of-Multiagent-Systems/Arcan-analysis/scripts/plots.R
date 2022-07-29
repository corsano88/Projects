library(dplyr)
library(ggplot2)
library(tidyr)
library(onewaytests)
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

# setwd("your_working_directory")


# choose the project you want to analyse
project = 'fjage'
# project = 'housing-model'
# project = 'jabm'
# project = 'madkit'
# project = 'matsim-libs'
# project = 'sof'

data <- read.csv(paste("dataset/",project,".csv",sep=''))

data <- data %>% arrange(arcan.version)

data <- subset(data, select=c("counter","AS","Type","GranularityValue","ADI","project","version","arcan.version"))

data.adi <- data %>% subset(select=c("ADI","arcan.version")) %>% group_by(arcan.version) %>% summarise(AS=first(AS)) %>% mutate(commit=as.numeric(rownames(.)))

# Plot
ggplot(data.adi, aes(x=commit,y=ADI)) + geom_line() + 
  geom_point() +
  labs(x = "Commit")




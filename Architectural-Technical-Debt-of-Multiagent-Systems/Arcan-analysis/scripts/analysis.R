library(dplyr)
library(ggplot2)
library(tidyr)
# library(onewaytests)
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
library(Kendall)


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

# ass num AS
tot.as <- nrow(data)
class.as <- data %>% filter(GranularityValue==1) %>% nrow()
package.as <- data %>% filter(GranularityValue==2) %>% nrow()

cd.as <- data %>% filter(Type=='cd') %>% nrow()
hl.as <- data %>% filter(Type=='hl') %>% nrow()
ud.as <- data %>% filter(Type=='ud') %>% nrow()

# mean types of as
as.mean.data <- subset(data, select=c("Type","version")) %>% mutate(count=1)
cd.as.mean.data <- as.mean.data %>% filter(Type=='cd') %>% group_by(version) %>% summarise(Type=first(Type),
                                                                                      count=sum(count))
hl.as.mean.data <- as.mean.data %>% filter(Type=='hl') %>% group_by(version) %>% summarise(Type=first(Type),
                                                                                     count=sum(count))
ud.as.mean.data <- as.mean.data %>% filter(Type=='ud') %>% group_by(version) %>% summarise(Type=first(Type),
                                                                                      count=sum(count))

cd.as.mean <- mean(cd.as.mean.data$count)
cd.std.dev <- sd(cd.as.mean.data$count)
cd.min <- min(cd.as.mean.data$count)
cd.max <- max(cd.as.mean.data$count)

hl.as.mean <- mean(hl.as.mean.data$count)
hl.std.dev <- sd(hl.as.mean.data$count)
hl.min <- min(hl.as.mean.data$count)
hl.max <- max(hl.as.mean.data$count)

ud.as.mean <- mean(ud.as.mean.data$count)
ud.std.dev <- sd(ud.as.mean.data$count)
ud.min <- min(ud.as.mean.data$count)
ud.max <- max(ud.as.mean.data$count)


# count types of AS
cd.as.cl <- data %>% filter(GranularityValue==1) %>% filter(Type=='cd') %>% nrow()
cd.as.pk <- data %>% filter(GranularityValue==2) %>% filter(Type=='cd') %>% nrow()
hl.as.cl <- data %>% filter(GranularityValue==1) %>% filter(Type=='hl') %>% nrow()
hl.as.pk <- data %>% filter(GranularityValue==2) %>% filter(Type=='hl') %>% nrow()


# average AS
data.mean <- subset(data, select=c("version")) %>% mutate(count=1) 
mean.as.data <- data.mean %>% group_by(version) %>% summarise(count = sum(count))
mean.as <- mean(mean.as.data$count)
std.dev <- sd(mean.as.data$count)
min.as <- min(mean.as.data$count)
max.as <- max(mean.as.data$count)



# average ADI
data.mean.adi <- subset(data, select=c("ADI","arcan.version")) %>% group_by(arcan.version) %>% summarise(ADI=first(ADI))

adi.mean <- mean(data.mean.adi$ADI)
adi.stdev <- sd(data.mean.adi$ADI)
adi.min <- min(data.mean.adi$ADI)
adi.max <- max(data.mean.adi$ADI)

# print output
paste(tot.as,class.as,package.as,cd.as,hl.as,ud.as,cd.as.cl,cd.as.pk,hl.as.cl,hl.as.pk,mean.as,std.dev,min.as,max.as,adi.mean,adi.stdev,adi.min,adi.max,sep=',')

paste(tot.as,cd.as,hl.as,ud.as,mean.as,std.dev,min.as,max.as,adi.mean,adi.stdev,adi.min,adi.max,sep=',')

paste(cd.as.mean, cd.std.dev, cd.min, cd.max, hl.as.mean, hl.std.dev, hl.min, hl.max, ud.as.mean, ud.std.dev, ud.min, ud.max,sep=',')



###### EVOLUTION ANALYSIS

data.mannkendall <- subset(data, select=c("ADI", "arcan.version")) %>% 
  mutate(count=1) %>%
  group_by(arcan.version) %>% 
  summarise(ADI = first(ADI),count = sum(count))

# run Mann - Kendall on ADI
kendall.df <- MannKendall(data.mannkendall$ADI)
kendall.df <- as.data.frame(do.call(cbind,kendall.df))
res <- kendall.df %>% mutate(sl=as.numeric(as.character(sl))) %>% filter(sl < 1)
res$variable <- "ADI"

# run Mann - Kendall on AS
kendall.df.as <- MannKendall(data.mannkendall$count)
kendall.df.as <- as.data.frame(do.call(cbind,kendall.df.as))
res.as <- kendall.df.as %>% mutate(sl=as.numeric(as.character(sl))) %>% filter(sl < 0.05)
res.as$variable <- "AS"
res <- rbind(res,res.as)


data.mannkendall.as <- subset(data, select=c("Type", "version")) %>% 
  mutate(count=1) %>%
  group_by(Type,version) %>% 
  summarise(count = sum(count))

data.mannkendall.cd <- data.mannkendall.as %>% filter(Type=="cd")
data.mannkendall.hl <- data.mannkendall.as %>% filter(Type=="hl")
data.mannkendall.ud <- data.mannkendall.as %>% filter(Type=="ud")

# run Mann - Kendall on CD
kendall.df.cd <- MannKendall(data.mannkendall.cd$count)
kendall.df.cd <- as.data.frame(do.call(cbind,kendall.df.cd))
res.cd <- kendall.df.cd %>% mutate(sl=as.numeric(as.character(sl))) %>% filter(sl < 0.05)
res.cd$variable <- "CD"
res <- rbind(res,res.cd)

# run Mann - Kendall on HL
kendall.df.hl <- MannKendall(data.mannkendall.hl$count)
kendall.df.hl <- as.data.frame(do.call(cbind,kendall.df.hl))
res.hl <- kendall.df.hl %>% mutate(sl=as.numeric(as.character(sl))) %>% filter(sl < 0.5)
res.hl$variable <- "HL"
res <- rbind(res,res.hl)

# run Mann - Kendall on UD
kendall.df.ud <- MannKendall(data.mannkendall.ud$count)
kendall.df.ud <- as.data.frame(do.call(cbind,kendall.df.ud))
res.ud <- kendall.df.ud %>% mutate(sl=as.numeric(as.character(sl))) %>% filter(sl < 0.5)
res.ud$variable <- "UD"
res <- rbind(res,res.ud)

write.csv(res, paste("dataset/",project,"-mannkendall.csv",sep=''))
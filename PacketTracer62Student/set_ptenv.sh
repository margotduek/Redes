#!/bin/bash
# sets the incoming PTDIR as a system environment variable
# by modifying /etc/profile 

PTDIR=$1
if [ -z $PTDIR ]; then
   echo "Using default directory: /opt/pt"
   PTDIR="/opt/pt"
fi

# check /etc/profile for existance of PT6HOME
PROFILE="/etc/profile" 

# error exit if file does not exist or unreadable
if [ ! -f $PROFILE ]; then
   echo "$PROFILE does not exists"
   exit 1
elif [ ! -r $PROFILE ]; then
   echo "$PROFILE: can not read"
   exit 2
fi

# read contents
CONTENTS=""
EXPORT_EXISTS=0
PT6HOME_EXISTS=0
PT6HOME_FOUND=0
exec 3<&0
exec 0<$PROFILE
while read -r line
do
  
  # replace existing entries
  PT6HOME_FOUND=`expr match "$line" 'PT6HOME'`
  if [ $PT6HOME_FOUND -gt 0 ]; then
	line="PT6HOME=$PTDIR"
        PT6HOME_EXISTS=1
  fi

  # check for export statement
  if [ $EXPORT_EXISTS -eq 0 ]; then
      EXPORT_EXISTS=`expr match "$line" 'export PT6HOME'`
  fi

  #append the line to the contents
  CONTENTS="$CONTENTS\n$line"
done
exec 0<&3

if [ $PT6HOME_EXISTS -eq 0 ]; then
  CONTENTS="$CONTENTS\nPT6HOME=$PTDIR"
fi

if [ $EXPORT_EXISTS -eq 0 ]; then
  CONTENTS="$CONTENTS\nexport PT6HOME"
fi

echo "Writing PT6HOME environment variable to /etc/profile"
sudo echo -e $CONTENTS > /etc/profile

exit 0 


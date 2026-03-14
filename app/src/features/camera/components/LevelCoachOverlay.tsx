import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { LevelCoachState } from '../hooks/useLevelCoach';

interface LevelCoachOverlayProps {

  state: LevelCoachState;

  cameraFrameTop: number;

  cameraFrameHeight: number;

  rotation: 0 | 90 | 180 | 270;

}



/**

 * Visual Level Indicator (Apple-style)

 * - Fixed Center Line (Phone Ref)

 * - Rotating Side Lines (Horizon Ref)

 * - Turns yellow and links up when level.

 * - Fades out if held level for a duration.

 */

export const LevelCoachOverlay: React.FC<LevelCoachOverlayProps> = ({

  state,

  cameraFrameTop,

  cameraFrameHeight,

  rotation,

}) => {

  const { angle, isLevel, isActive } = state;

  const opacityAnim = useRef(new Animated.Value(0)).current;

  const levelTimer = useRef<NodeJS.Timeout | null>(null);

  const [isLevelHeld, setIsLevelHeld] = useState(false);



  // Handle Level Hold Timer

  useEffect(() => {

    if (isLevel) {

      if (!levelTimer.current) {

        levelTimer.current = setTimeout(() => {

          setIsLevelHeld(true);

        }, 1000); // 1 second hold to disappear

      }

    } else {

      if (levelTimer.current) {

        clearTimeout(levelTimer.current);

        levelTimer.current = null;

      }

      setIsLevelHeld(false);

    }

    return () => {

      if (levelTimer.current) clearTimeout(levelTimer.current);

    };

  }, [isLevel]);



  // Visibility Logic

  // Show if:

  // 1. Active AND

  // 2. Not held level for too long AND

  // 3. (Not Level OR (Level AND Not Held)) -> Effectively !isLevelHeld

  // 4. Also ignore extreme angles (> 45 deg? User didn't specify, but assume 20 from before)

  const shouldShow = isActive && !isLevelHeld && Math.abs(angle) < 20;



  useEffect(() => {

    Animated.timing(opacityAnim, {

      toValue: shouldShow ? 1 : 0,

      duration: 200,

      useNativeDriver: true,

    }).start();

  }, [shouldShow]);



  const lineColor = isLevel ? '#ffe81f' : 'rgba(255, 255, 255, 0.8)';

  const rotateStr = `${angle}deg`;



  // UI Rotation (Orientation)

  // We rotate the entire container to match the UI orientation (Portrait/Landscape)

  const uiRotateStr = `${rotation}deg`;



  return (

    <View 

      style={[

        styles.container, 

        { 

          top: cameraFrameTop, 

          height: cameraFrameHeight,

          transform: [{ rotate: uiRotateStr }] // Rotate entire overlay for Landscape

        }

      ]} 

      pointerEvents="none"

    >

      <Animated.View style={{ opacity: opacityAnim }}>

                <View style={styles.levelContainer}>

                  {/* Rotating Center Line (Horizon Ref) */}

                  <View style={[styles.fixedLine, { backgroundColor: lineColor, transform: [{ rotate: rotateStr }] }]} />

        

                            {/* Fixed Side Lines (Phone Ref) */}

        

                            <View style={styles.rotatingContainer}>

        

                              <View style={[styles.shortLine, { marginRight: 30, backgroundColor: lineColor }]} />

        

                              <View style={[styles.shortLine, { marginLeft: 30, backgroundColor: lineColor }]} />

        

                            </View>

        

                          </View>

      </Animated.View>

    </View>

  );

};



const styles = StyleSheet.create({

  container: {

    position: 'absolute',

    left: 0,

    right: 0,

    justifyContent: 'center',

    alignItems: 'center',

    zIndex: 10,

  },

  levelContainer: {

    justifyContent: 'center',

    alignItems: 'center',

    width: 300, 

    height: 100, // Hitbox

  },

  fixedLine: {

    width: 60,

    height: 1.5,

    borderRadius: 1,

    position: 'absolute',

  },

  rotatingContainer: {

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    position: 'absolute',

    width: '100%',

  },

  shortLine: {

    width: 20,

    height: 1.5,

    borderRadius: 1,

  },

});

import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';

type IconName = keyof typeof Ionicons.glyphMap;

interface Props extends ComponentProps<typeof Ionicons> {
  name: IconName;
}

export const Icon = (props: Props) => {
  return <Ionicons {...props} />;
};

export type { IconName };

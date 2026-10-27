import React from 'react';
import { IconButton, Tooltip } from '@chakra-ui/react';
import { useThemedColors } from '../theme/colors';

export type AppIconButtonProps = {
  ariaLabel: string;
  icon?: React.ReactElement;
  onClick?: VoidFunction;
  withBackground?: boolean;
  size?: (string & {}) | 'sm' | 'md' | 'lg' | 'xs' | undefined;
  tooltip?: string;
  disabled?: boolean;
  [key: string]: any;
};

export default function AppIconButton({
  ariaLabel,
  icon,
  onClick,
  withBackground,
  size,
  tooltip,
  disabled,
  ...rest
}: AppIconButtonProps) {
  const colors = useThemedColors();
  return (
    <Tooltip label={tooltip}>
      <IconButton
        aria-label={ariaLabel}
        icon={icon}
        onClick={onClick}
        borderRadius="50%"
        marginX="1px"
        size={size}
        isDisabled={disabled}
        backgroundColor={!withBackground ? 'transparent' : colors.darkLight}
        color={colors.white}
        {...rest}
        _active={
          !withBackground
            ? {
                background: 'none',
              }
            : {}
        }
        _hover={
          !withBackground
            ? {
                background: 'transparent',
              }
            : {}
        }
      ></IconButton>
    </Tooltip>
  );
}

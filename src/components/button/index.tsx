import { TouchableOpacity,TouchableOpacityProps, Text } from "react-native";
import styles from "./style";


type props = TouchableOpacityProps & {
  title: string;
}

export function Button({ title, ...rest }: props) {
  return (
    <TouchableOpacity
        activeOpacity={0.8}
        {...rest}    
    >
      <Text style={styles.label}>{title}</Text>
    </TouchableOpacity>
  );
}
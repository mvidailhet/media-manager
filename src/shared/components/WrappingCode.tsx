import { Code, type CodeProps } from "@mantine/core";

import styles from "./WrappingCode.module.css";

export function WrappingCode(props: CodeProps) {
  return <Code {...props} className={styles.code} />;
}

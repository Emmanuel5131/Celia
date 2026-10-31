/**
 * The frame of a case: its page, and the slot where one of its lists opens as a popup over the page.
 * @param props - The layout props.
 * @param props.children - The page.
 * @param props.modal - The popup, or nothing.
 * @returns The page with its popup.
 */
export default function CaseLayout(props: { children: React.ReactNode; modal: React.ReactNode }) {
  return (
    <>
      {props.children}
      {props.modal}
    </>
  );
}

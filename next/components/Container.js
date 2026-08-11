// next/components/Container.js

const Container = ({ as: Component = "div", children, className = "", ...rest }) => {
  return (
    <Component className={`w-container mx-auto ${className}`.trim()} {...rest}>
      {children}
    </Component>
  );
};

export default Container;

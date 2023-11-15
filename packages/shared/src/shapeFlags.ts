/**
在位运算中，<< 表示左移操作，将一个数的二进制表示向左移动指定的位数。每向左移动一位，相当于将原数乘以2。

对于表达式 1 << 4，表示将数字 1 的二进制表示向左移动 4 位。计算过程如下：

1 的二进制表示：0001

左移 4 位后，得到：00010000

转换为十进制，结果为：16

因此，1 << 4 的结果是 16。
 */
export const enum ShapeFlags {
    /**
     * type = Element
     */
    ELEMENT = 1,
    /**
     * 函数组件
     */
    FUNCTIONAL_COMPONENT = 1 << 1,
    /**
     * 有状态（响应数据）组件
     */
    STATEFUL_COMPONENT = 1 << 2,
    /**
     * children = Text
     */
    TEXT_CHILDREN = 1 << 3,
    /**
     * children = Array
     */
    ARRAY_CHILDREN = 1 << 4,
    /**
     * children = slot
     */
    SLOTS_CHILDREN = 1 << 5,
    /**
     * 组件：有状态（响应数据）组件 | 函数组件
     */
    COMPONENT = ShapeFlags.STATEFUL_COMPONENT | ShapeFlags.FUNCTIONAL_COMPONENT
  }
  
  
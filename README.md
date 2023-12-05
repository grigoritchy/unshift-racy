# unshift-racy
Webkit JavascriptCore array unshift race condition, it leads to RCE.


# Summary
There was a race condition between unshift function and ArrayStorage's butterfly in DFG.  
  
I discovered this bug in 2018 October, November. but unfortunately buggy code was patched after i written exploit. (my co-worker @sweetchip also discovered kind of this issue)  
  
Webkit patched their code like this => [link](https://github.com/WebKit/WebKit/commit/266a919459e8ee1b42cb5b02072911bf96c675e9)


# Exploit detail
When GetByVal operation of DFG jit tier access ArrayStorage's butterfly and trying to lookup it's HashTable, At that time it can overwrite own HashMap's structure.  
So exploit way is construct corrupted structure of the HashMap to return my fake object.  

Here is my exploit step.  
  
1. Setting all HashMap values such as m_tableSize, m_tableSizeMask, m_keyCount, m_deletedCount to return specific entry where my HashTable layout located.

2. Setting value of the HashTable with specific defined address. It will point to my sprayed data(part of step 3). And after finish lookup HashTable, It must have both PropertyAttribute::ReadOnly and PropertyAttribute::DontDelete attribute types. Let contains attribute those types. (1)


```
 Layout of the HashTable (1)

--------------------------------
|     ...     |       key      |
--------------------------------
|    value    |    attribute   |
--------------------------------
```


3. Spraying data to get fake object. See spraying layout at the following table. (2)


```
 Layout of the Spraying data (2)

-------------------------------
| padding data | padding data |
-------------------------------
|   fake cell  |   unboxed    |
-------------------------------
| padding data | padding data |
-------------------------------
```


4. When HashTable's value point to sprayed data properly, It can get arbitrary R/W primitive by using unboxed and boxed object.

5. Code execution with arbitrary R/W.
  
  
**This exploit is not optimized.** And need some heap spray. It has 1/5(no guarantee of precision) success in jsc.

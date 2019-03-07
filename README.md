# unshift-racy
Webkit JavascriptCore array unshift race condition, it lead to RCE.


# Summary
There was a race condition between unshift function and ArrayStorage's butterfly in DFG.
I discovered this bug in 2018 October, November. but unfortunately buggy code was patched after i written exploit. (my co-worker @sweetchip also discovered kind of this issue)
Webkit patched their code [here](https://github.com/WebKit/webkit/commit/c7f40e9c4f8cd7ce71389466560f010437b2097f)


# Exploit detail
When GetByVal operation of DFG jit tier access ArrayStorage's butterfly and trying to lookup HashTable values, at that time it can overwrite own HashMap's structure. 
So exploit way is construct corrupted structure of the HashMap to return my fake object, which is created by HashTable.

Here is my exploit step.

1. Setting all HashTable values such as m_tableSize, m_tableSizeMask, m_keyCount, m_deletedCount to return specific entry, which my HashTable layout is located.

2. Setting structure of the HashTable. Setting specific defined address to HashTable's value. it will point to my sprayed data. And after finish lookup in the HashTable, It must have both PropertyAttribute::ReadOnly and PropertyAttribute::DontDelete attribute types.


```
 layout of the HashTable
----------------------------------------------
           ...         |         key         |
----------------------------------------------
|         value        |      attribute      |
----------------------------------------------
```


3. Spraying data to get fake object.

```
-------------------------------
| padding data | padding data |
-------------------------------
|   fake cell  |   unboxed    |
-------------------------------
| padding data | padding data |
-------------------------------
```

4. When HashTable's value point to sprayed data properly, It can get arbitrary r/w primitive by using unboxed and boxed object.

5. code execution with arbitrary r/w.

**This exploit is not optimized.** need some heap spray. It has 1/5(no guarantee of precision) success in jsc.

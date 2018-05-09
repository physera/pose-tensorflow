import setuptools

PACKAGE_NAME = 'pose_tensorflow'
VERSION = '0.0.1'

setuptools.setup(
    name=PACKAGE_NAME,
    packages=[PACKAGE_NAME, PACKAGE_NAME + '.nnet'],
    version=VERSION,
    description='Estimate human poses in images',
    classifiers=[
        'Development Status :: 3 - Alpha',
        'Environment :: Console',
        'License :: OSI Approved :: GNU Lesser General Public License v3 (LGPLv3)',
        'Programming Language :: Python',
        'Topic :: Scientific/Engineering :: Artificial Intelligence',
        'Topic :: Scientific/Engineering :: Image Recognition',
        'Topic :: Scientific/Engineering :: Visualization',
    ],
    keywords='pose estimation tensorflow',
    author='Jonathan Chang',
    author_email='jonathan@physera.com',
    url='https://github.com/physera/pose-tensorflow',
    install_requires=[
        'easydict',
        'imageio',
        'numpy',
        'Pillow',
        'PyYAML',
        'scipy',
        'tensorflow',
    ],
    license='LGPLv3',
    zip_safe=False,
)

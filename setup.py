import setuptools

PACKAGE_NAME = 'pose_tensorflow'
VERSION = '0.0.1'

setuptools.setup(
    name=PACKAGE_NAME,
    packages=[PACKAGE_NAME, PACKAGE_NAME + '.nnet', PACKAGE_NAME + '.dataset'],
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
    package_data={
        PACKAGE_NAME: ['pose_cfg.yaml'],
    },
    keywords='pose estimation tensorflow',
    author='Jonathan Chang',
    author_email='jonathan@physera.com',
    url='https://github.com/physera/pose-tensorflow',
    install_requires=[
        "easydict==1.7",
        "imageio==2.3.0",
        "numpy==1.14.3",
        "Pillow==5.1.0",
        "PyYAML==3.12",
        "scipy==1.1.0",
        "tensorflow==1.8.0"
    ],
    license='LGPLv3',
    zip_safe=False,
)
